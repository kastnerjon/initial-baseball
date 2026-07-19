import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const INPUT_DIR = resolve(PACKAGE_DIR, 'reports/canonical-season-facts');
const OUTPUT_DIR = resolve(PACKAGE_DIR, 'reports/canonical-season-aggregates');
const args = process.argv.slice(2);
const strict = args.includes('--strict');

const sources = {
  batting: readArtifact('batting-stints.json'),
  pitching: readArtifact('pitching-stints.json'),
  appearances: readArtifact('appearances.json'),
};

const batting = aggregate(sources.batting.artifact.facts ?? [], BAT_FIELDS);
const pitching = aggregate(sources.pitching.artifact.facts ?? [], PITCH_FIELDS);
const appearances = aggregate(sources.appearances.artifact.facts ?? [], APPEARANCE_FIELDS);
const validation = validate({ batting, pitching, appearances, sources });
const sourceManifest = {
  schemaVersion: 1,
  batting: manifestEntry('packages/baseball-data/reports/canonical-season-facts/batting-stints.json', sources.batting.text),
  pitching: manifestEntry('packages/baseball-data/reports/canonical-season-facts/pitching-stints.json', sources.pitching.text),
  appearances: manifestEntry('packages/baseball-data/reports/canonical-season-facts/appearances.json', sources.appearances.text),
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeJson('batting-seasons.json', { schemaVersion: 1, sourceManifest, facts: batting });
writeJson('pitching-seasons.json', { schemaVersion: 1, sourceManifest, facts: pitching });
writeJson('appearance-seasons.json', { schemaVersion: 1, sourceManifest, facts: appearances });
writeJson('canonical-season-aggregates-report.json', { schemaVersion: 1, sourceManifest, ...validation });
writeFileSync(resolve(OUTPUT_DIR, 'canonical-season-aggregates-report.md'), renderMarkdown(validation));

console.log(`Built ${batting.length} batting seasons, ${pitching.length} pitching seasons, and ${appearances.length} appearance seasons. Critical issues: ${validation.summary.criticalIssueCount}.`);
if (strict && validation.summary.criticalIssueCount > 0) process.exitCode = 1;

const BAT_FIELDS = ['games','atBats','runs','hits','doubles','triples','homeRuns','runsBattedIn','stolenBases','caughtStealing','walks','strikeouts','intentionalWalks','hitByPitch','sacrificeHits','sacrificeFlies','groundedIntoDoublePlay'];
const PITCH_FIELDS = ['wins','losses','games','gamesStarted','completeGames','shutouts','saves','outsPitched','hitsAllowed','earnedRuns','homeRunsAllowed','walksAllowed','strikeouts','opponentBattersFaced','intentionalWalks','wildPitches','hitBatters','balks','runsAllowed','sacrificeHitsAllowed','sacrificeFliesAllowed','groundedIntoDoublePlay'];
const APPEARANCE_FIELDS = ['gamesAll','gamesStarted','gamesBatting','gamesDefense','gamesPitcher','gamesCatcher','gamesFirstBase','gamesSecondBase','gamesThirdBase','gamesShortstop','gamesLeftField','gamesCenterField','gamesRightField','gamesOutfield','gamesDesignatedHitter','gamesPinchHitter','gamesPinchRunner'];

function aggregate(facts, fields) {
  const groups = new Map();
  for (const fact of facts) {
    const key = `${fact.playerId}|${fact.season}`;
    const group = groups.get(key) ?? {
      playerId: fact.playerId,
      lahmanPlayerId: fact.lahmanPlayerId,
      season: fact.season,
      teamIds: new Set(),
      leagueIds: new Set(),
      stintCount: 0,
      values: Object.fromEntries(fields.map((field) => [field, { total: 0, present: 0 }])),
    };
    if (fact.teamId) group.teamIds.add(fact.teamId);
    if (fact.leagueId) group.leagueIds.add(fact.leagueId);
    group.stintCount += 1;
    for (const field of fields) {
      if (fact[field] !== null && fact[field] !== undefined) {
        group.values[field].total += fact[field];
        group.values[field].present += 1;
      }
    }
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    playerId: group.playerId,
    lahmanPlayerId: group.lahmanPlayerId,
    season: group.season,
    teamIds: [...group.teamIds].sort(),
    leagueIds: [...group.leagueIds].sort(),
    stintCount: group.stintCount,
    ...Object.fromEntries(fields.map((field) => [field, group.values[field].present > 0 ? group.values[field].total : null])),
  })).sort(compareSeason);
}

function validate({ batting, pitching, appearances, sources }) {
  const criticalIssues = [];
  const duplicateKeys = {
    batting: duplicates(batting),
    pitching: duplicates(pitching),
    appearances: duplicates(appearances),
  };
  for (const [kind, keys] of Object.entries(duplicateKeys)) {
    for (const key of keys) criticalIssues.push(`${kind} duplicate player-season: ${key}`);
  }
  const reconciliation = {
    batting: reconcile(batting, sources.batting.artifact.facts ?? [], BAT_FIELDS),
    pitching: reconcile(pitching, sources.pitching.artifact.facts ?? [], PITCH_FIELDS),
    appearances: reconcile(appearances, sources.appearances.artifact.facts ?? [], APPEARANCE_FIELDS),
  };
  for (const [kind, issues] of Object.entries(reconciliation)) {
    for (const issue of issues) criticalIssues.push(`${kind} reconciliation: ${issue}`);
  }
  return {
    summary: {
      battingSeasonCount: batting.length,
      pitchingSeasonCount: pitching.length,
      appearanceSeasonCount: appearances.length,
      twoWayPlayerSeasonCount: intersectionCount(batting, pitching),
      multiTeamBattingSeasonCount: batting.filter((fact) => fact.teamIds.length > 1).length,
      multiTeamPitchingSeasonCount: pitching.filter((fact) => fact.teamIds.length > 1).length,
      criticalIssueCount: criticalIssues.length,
    },
    validation: { duplicateKeys, reconciliation, criticalIssues },
  };
}

function reconcile(aggregates, stints, fields) {
  const aggregateByKey = new Map(aggregates.map((fact) => [seasonKey(fact), fact]));
  const expected = aggregate(stints, fields);
  const issues = [];
  for (const fact of expected) {
    const actual = aggregateByKey.get(seasonKey(fact));
    if (!actual) { issues.push(`missing ${seasonKey(fact)}`); continue; }
    for (const field of fields) {
      if (actual[field] !== fact[field]) issues.push(`${seasonKey(fact)} ${field}: ${actual[field]} != ${fact[field]}`);
    }
    if (JSON.stringify(actual.teamIds) !== JSON.stringify(fact.teamIds)) issues.push(`${seasonKey(fact)} teamIds differ`);
  }
  return issues;
}

function duplicates(facts) {
  const seen = new Set();
  const result = new Set();
  for (const fact of facts) {
    const key = seasonKey(fact);
    if (seen.has(key)) result.add(key);
    seen.add(key);
  }
  return [...result].sort();
}

function intersectionCount(left, right) {
  const keys = new Set(left.map(seasonKey));
  return new Set(right.map(seasonKey).filter((key) => keys.has(key))).size;
}
function seasonKey(fact) { return `${fact.playerId}|${fact.season}`; }
function compareSeason(left, right) { return left.playerId.localeCompare(right.playerId) || left.season - right.season; }
function manifestEntry(path, text) { return { path, sha256: createHash('sha256').update(text).digest('hex') }; }
function readArtifact(name) { const text = readFileSync(resolve(INPUT_DIR, name), 'utf8'); return { text, artifact: JSON.parse(text) }; }
function writeJson(name, value) { writeFileSync(resolve(OUTPUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`); }
function renderMarkdown(report) {
  return `# Canonical Player-Season Aggregates\n\nThis remains a shadow artifact; the live game is unchanged.\n\n## Summary\n\n- Batting seasons: ${report.summary.battingSeasonCount}\n- Pitching seasons: ${report.summary.pitchingSeasonCount}\n- Appearance seasons: ${report.summary.appearanceSeasonCount}\n- Two-way player-seasons: ${report.summary.twoWayPlayerSeasonCount}\n- Multi-team batting seasons: ${report.summary.multiTeamBattingSeasonCount}\n- Multi-team pitching seasons: ${report.summary.multiTeamPitchingSeasonCount}\n- Critical issues: ${report.summary.criticalIssueCount}\n\n## Contract\n\n- One row per canonical player and season.\n- Counting statistics sum across source stints.\n- A field remains null only when every contributing stint is null.\n- Team and league histories remain explicit sorted arrays.\n- Raw stint artifacts remain authoritative and auditable.\n- Career aggregation and runtime migration remain deferred.\n`;
}
