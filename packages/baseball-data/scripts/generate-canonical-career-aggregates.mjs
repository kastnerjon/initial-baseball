import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seasonDir = resolve(packageDir, 'reports/canonical-season-aggregates');
const universeDir = resolve(packageDir, 'reports/canonical-universe');
const outputDir = resolve(packageDir, 'reports/canonical-career-aggregates');
const strict = process.argv.includes('--strict');
const fields = {
  batting: ['atBats','runs','hits','doubles','triples','homeRuns','runsBattedIn','stolenBases','walks','hitByPitch','sacrificeFlies'],
  pitching: ['wins','losses','saves','outsPitched','hitsAllowed','earnedRuns','walksAllowed','strikeouts'],
  appearances: ['gamesAll','gamesPitcher','gamesCatcher','gamesFirstBase','gamesSecondBase','gamesThirdBase','gamesShortstop','gamesLeftField','gamesCenterField','gamesRightField','gamesDesignatedHitter'],
};
const inputs = {
  universe: read(resolve(universeDir, 'canonical-player-universe.json')),
  batting: read(resolve(seasonDir, 'batting-seasons.json')),
  pitching: read(resolve(seasonDir, 'pitching-seasons.json')),
  appearances: read(resolve(seasonDir, 'appearance-seasons.json')),
};
const players = inputs.universe.value.players ?? [];
const byCanonical = index(players, p => p.canonicalId, 'canonical ID');
const byLahman = index(players, p => p.lahmanPlayerId, 'Lahman ID');
const source = {
  batting: inputs.batting.value.facts ?? [],
  pitching: inputs.pitching.value.facts ?? [],
  appearances: inputs.appearances.value.facts ?? [],
};
const careers = Object.fromEntries(Object.keys(fields).map(kind => [kind, aggregate(source[kind], fields[kind])]));
const issues = [];
for (const kind of Object.keys(fields)) reconcile(kind, careers[kind], source[kind], fields[kind], issues);
regression(issues);
const manifest = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, { path: input.path, schemaVersion: input.value.schemaVersion ?? null, sha256: hash(input.text) }]));

mkdirSync(outputDir, { recursive: true });
for (const kind of Object.keys(careers)) write(`${kind === 'appearances' ? 'appearance' : kind}-careers.json`, { schemaVersion: 1, sourceManifest: manifest, facts: careers[kind] });
const summary = {
  battingCareerCount: careers.batting.length,
  pitchingCareerCount: careers.pitching.length,
  appearanceCareerCount: careers.appearances.length,
  twoWayCareerCount: careers.pitching.filter(row => new Set(careers.batting.map(x => x.playerId)).has(row.playerId)).length,
  criticalIssueCount: issues.length,
};
write('canonical-career-aggregates-report.json', { schemaVersion: 1, sourceManifest: manifest, summary, criticalIssues: issues });
writeFileSync(resolve(outputDir, 'canonical-career-aggregates-report.md'), `# Canonical Career Aggregates Report\n\n- Batting careers: ${summary.battingCareerCount}\n- Pitching careers: ${summary.pitchingCareerCount}\n- Appearance careers: ${summary.appearanceCareerCount}\n- Two-way careers: ${summary.twoWayCareerCount}\n- Critical issues: ${summary.criticalIssueCount}\n\n${issues.length ? issues.map(x => `- ${x}`).join('\n') : 'No critical issues.'}\n`);
console.log(`Built ${summary.battingCareerCount} batting, ${summary.pitchingCareerCount} pitching, and ${summary.appearanceCareerCount} appearance careers. Critical issues: ${issues.length}.`);
if (strict && issues.length) process.exitCode = 1;

function aggregate(rows, statFields) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.playerId || !row.lahmanPlayerId || !Number.isInteger(row.season)) throw new Error(`Malformed season row: ${JSON.stringify(row)}`);
    const group = groups.get(row.playerId) ?? { playerId: row.playerId, lahmanPlayerId: row.lahmanPlayerId, seasons: new Set(), teams: new Set(), rows: 0, stats: Object.fromEntries(statFields.map(f => [f, { total: 0, present: 0 }])) };
    if (group.lahmanPlayerId !== row.lahmanPlayerId) throw new Error(`Conflicting Lahman IDs for ${row.playerId}`);
    group.seasons.add(row.season);
    for (const team of row.teamIds ?? []) group.teams.add(team);
    group.rows += 1;
    for (const field of statFields) {
      const value = row[field];
      if (value == null) continue;
      if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid ${field} for ${row.playerId}:${row.season}`);
      group.stats[field].total += value;
      group.stats[field].present += 1;
    }
    groups.set(row.playerId, group);
  }
  return [...groups.values()].map(group => {
    const seasons = [...group.seasons].sort((a,b) => a-b);
    return {
      playerId: group.playerId,
      lahmanPlayerId: group.lahmanPlayerId,
      firstSeason: seasons[0],
      lastSeason: seasons.at(-1),
      seasonCount: seasons.length,
      sourceSeasonCount: group.rows,
      teamIds: [...group.teams].sort(),
      ...Object.fromEntries(statFields.map(field => [field, group.stats[field].present ? group.stats[field].total : null])),
    };
  }).sort((a,b) => a.playerId.localeCompare(b.playerId));
}

function reconcile(kind, output, rows, statFields, out) {
  const outputById = index(output, row => row.playerId, `${kind} career ID`, out);
  const grouped = group(rows, row => row.playerId);
  if (outputById.size !== grouped.size) out.push(`${kind} output count ${outputById.size} != source count ${grouped.size}`);
  for (const [playerId, seasons] of grouped) {
    const career = outputById.get(playerId);
    if (!career) { out.push(`${kind} missing ${playerId}`); continue; }
    const player = byCanonical.get(playerId);
    if (!player || player.lahmanPlayerId !== career.lahmanPlayerId) out.push(`${kind} identity mismatch ${playerId}`);
    const years = [...new Set(seasons.map(x => x.season))].sort((a,b) => a-b);
    const teams = [...new Set(seasons.flatMap(x => x.teamIds ?? []))].sort();
    if (career.firstSeason !== years[0] || career.lastSeason !== years.at(-1) || career.seasonCount !== years.length || career.sourceSeasonCount !== seasons.length) out.push(`${kind} career range/count mismatch ${playerId}`);
    if (JSON.stringify(career.teamIds) !== JSON.stringify(teams)) out.push(`${kind} team mismatch ${playerId}`);
    if (new Set(seasons.map(x => x.lahmanPlayerId)).size !== 1) out.push(`${kind} source identity conflict ${playerId}`);
    for (const field of statFields) {
      const values = seasons.map(x => x[field]).filter(x => x != null);
      const expected = values.length ? values.reduce((a,b) => a+b, 0) : null;
      if (career[field] !== expected) out.push(`${kind} ${field} mismatch ${playerId}`);
    }
  }
  for (const id of outputById.keys()) if (!grouped.has(id)) out.push(`${kind} unexpected ${id}`);
}

function regression(out) {
  const tests = [
    ['griffke02','batting','homeRuns',630],
    ['wrighda03','batting','homeRuns',242],
    ['ortizda01','batting','homeRuns',541],
    ['riverma01','pitching','saves',652],
  ];
  const maps = { batting: new Map(careers.batting.map(x => [x.playerId,x])), pitching: new Map(careers.pitching.map(x => [x.playerId,x])) };
  for (const [lahmanId, kind, field, expected] of tests) {
    const player = byLahman.get(lahmanId);
    const career = player && maps[kind].get(player.canonicalId);
    if (!career) out.push(`Regression career missing: ${lahmanId}`);
    else if (career.lahmanPlayerId !== lahmanId || career[field] !== expected) out.push(`Regression failed: ${lahmanId}.${field}`);
  }
}

function read(path) { const text = readFileSync(path, 'utf8'); return { path, text, value: JSON.parse(text) }; }
function write(name, value) { writeFileSync(resolve(outputDir, name), `${JSON.stringify(value, null, 2)}\n`); }
function hash(text) { return createHash('sha256').update(text).digest('hex'); }
function group(rows, fn) { const map = new Map(); for (const row of rows) { const key = fn(row); const list = map.get(key) ?? []; list.push(row); map.set(key,list); } return map; }
function index(rows, fn, label, out = null) { const map = new Map(); for (const row of rows) { const key = fn(row); if (!key) { if (out) out.push(`Missing ${label}`); else throw new Error(`Missing ${label}`); continue; } if (map.has(key)) { if (out) out.push(`Duplicate ${label}: ${key}`); else throw new Error(`Duplicate ${label}: ${key}`); } else map.set(key,row); } return map; }
