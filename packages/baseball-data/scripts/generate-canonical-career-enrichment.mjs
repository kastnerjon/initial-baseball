import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const careerCardPath = resolve(packageDir, 'reports/canonical-career-cards/career-cards.json');
const battingCareerPath = resolve(packageDir, 'reports/canonical-career-aggregates/batting-careers.json');
const hallOfFamePath = resolve(packageDir, 'data/lahman/HallOfFame.csv');
const outputDir = resolve(packageDir, 'reports/canonical-career-enrichment');
const strict = process.argv.includes('--strict');

const inputs = {
  careerCards: readJson(careerCardPath),
  battingCareers: readJson(battingCareerPath),
  hallOfFame: readText(hallOfFamePath),
};

const cards = inputs.careerCards.value.cards ?? [];
const battingByPlayerId = uniqueIndex(inputs.battingCareers.value.facts ?? [], row => row.playerId, 'batting career');
const hallRowsByLahmanId = group(parseCsv(inputs.hallOfFame.text).filter(row => row.playerID), row => row.playerID.trim());
const issues = [];

const enrichments = cards.map(card => buildEnrichment(card)).sort((a, b) => a.playerId.localeCompare(b.playerId));
validate(enrichments, issues);
regression(enrichments, issues);

const sourceManifest = {
  careerCards: manifestJson(inputs.careerCards),
  battingCareers: manifestJson(inputs.battingCareers),
  hallOfFame: {
    path: relativePath(hallOfFamePath),
    sha256: sha256(inputs.hallOfFame.text),
  },
  unavailableSources: {
    war: 'No committed, licensed WAR source is present.',
    opsPlus: 'No committed league-adjusted batting source is present.',
    eraPlus: 'No committed league-adjusted pitching source is present.',
    awards: 'No committed player-awards table is present.',
    allStarSelections: 'No committed All-Star table is present.',
    leagueLeaders: 'Not yet derived from canonical season aggregates.',
  },
};

const summary = {
  careerCardCount: cards.length,
  enrichmentCount: enrichments.length,
  opsCount: enrichments.filter(row => row.advanced.ops != null).length,
  inductedHallOfFameCount: enrichments.filter(row => row.achievements.hallOfFame?.inducted).length,
  criticalIssueCount: issues.length,
};

mkdirSync(outputDir, { recursive: true });
writeJson(resolve(outputDir, 'career-enrichment.json'), { schemaVersion: 1, sourceManifest, enrichments });
writeJson(resolve(outputDir, 'canonical-career-enrichment-report.json'), { schemaVersion: 1, sourceManifest, summary, criticalIssues: issues });
writeFileSync(resolve(outputDir, 'canonical-career-enrichment-report.md'), renderMarkdown(summary, issues));
console.log(`Built ${enrichments.length} canonical career enrichments. OPS: ${summary.opsCount}. Hall inductees: ${summary.inductedHallOfFameCount}. Critical issues: ${issues.length}.`);
if (strict && issues.length) process.exitCode = 1;

function buildEnrichment(card) {
  const batting = battingByPlayerId.get(card.playerId) ?? null;
  const hallRows = hallRowsByLahmanId.get(card.lahmanPlayerId) ?? [];
  const playerRows = hallRows.filter(row => String(row.category ?? '').trim().toLowerCase() === 'player');
  const inductedRows = playerRows.filter(row => String(row.inducted ?? '').trim().toUpperCase() === 'Y');
  const induction = inductedRows
    .map(row => ({
      year: integer(row.yearid),
      votedBy: text(row.votedBy),
      ballots: integer(row.ballots),
      needed: integer(row.needed),
      votes: integer(row.votes),
    }))
    .sort((a, b) => (a.year ?? Number.MAX_SAFE_INTEGER) - (b.year ?? Number.MAX_SAFE_INTEGER))[0] ?? null;

  const onBasePercentage = batting ? deriveOnBasePercentage(batting) : null;
  const sluggingPercentage = batting ? deriveSluggingPercentage(batting) : null;
  const ops = onBasePercentage != null && sluggingPercentage != null
    ? onBasePercentage + sluggingPercentage
    : null;

  return {
    schemaVersion: 1,
    playerId: card.playerId,
    lahmanPlayerId: card.lahmanPlayerId,
    advanced: {
      onBasePercentage,
      sluggingPercentage,
      ops,
      war: null,
      opsPlus: null,
      eraPlus: null,
      fip: null,
    },
    achievements: {
      hallOfFame: {
        inducted: Boolean(induction),
        induction,
        ballotAppearances: playerRows.length,
      },
      awards: null,
      allStarSelections: null,
      leagueLeaders: null,
    },
    provenance: {
      ops: ops == null ? null : 'derived_from_canonical_lahman_career_totals',
      hallOfFame: 'lahman_hall_of_fame',
      unavailableFieldsRemainNull: true,
    },
  };
}

function deriveOnBasePercentage(row) {
  const values = [row.hits, row.walks, row.hitByPitch, row.atBats, row.sacrificeFlies];
  if (!allKnown(values)) return null;
  const denominator = row.atBats + row.walks + row.hitByPitch + row.sacrificeFlies;
  return denominator > 0 ? (row.hits + row.walks + row.hitByPitch) / denominator : null;
}

function deriveSluggingPercentage(row) {
  const values = [row.hits, row.doubles, row.triples, row.homeRuns, row.atBats];
  if (!allKnown(values) || row.atBats <= 0) return null;
  const totalBases = row.hits + row.doubles + (2 * row.triples) + (3 * row.homeRuns);
  return totalBases / row.atBats;
}

function validate(rows, out) {
  const cardsById = uniqueIndex(cards, row => row.playerId, 'career card');
  const rowsById = uniqueIndex(rows, row => row.playerId, 'career enrichment', out);
  if (rows.length !== cards.length) out.push(`Enrichment count ${rows.length} != career card count ${cards.length}`);
  for (const card of cards) if (!rowsById.has(card.playerId)) out.push(`Missing enrichment: ${card.playerId}`);
  for (const row of rows) {
    const card = cardsById.get(row.playerId);
    if (!card || card.lahmanPlayerId !== row.lahmanPlayerId) out.push(`Identity mismatch: ${row.playerId}`);
    if (row.advanced.ops != null) {
      if (row.advanced.onBasePercentage == null || row.advanced.sluggingPercentage == null) out.push(`OPS missing component: ${row.playerId}`);
      if (Math.abs(row.advanced.ops - (row.advanced.onBasePercentage + row.advanced.sluggingPercentage)) > 1e-12) out.push(`OPS reconciliation failed: ${row.playerId}`);
    }
    if (row.advanced.war !== null || row.advanced.opsPlus !== null || row.advanced.eraPlus !== null || row.advanced.fip !== null) out.push(`Unsupported advanced value populated: ${row.playerId}`);
    if (row.achievements.awards !== null || row.achievements.allStarSelections !== null || row.achievements.leagueLeaders !== null) out.push(`Unsupported achievement populated: ${row.playerId}`);
  }
}

function regression(rows, out) {
  const byLahman = new Map(rows.map(row => [row.lahmanPlayerId, row]));
  const tests = [
    ['ortizda01', true, true],
    ['riverma01', false, true],
    ['griffke02', true, true],
    ['wrighda03', true, false],
  ];
  for (const [lahmanId, expectOps, expectHall] of tests) {
    const row = byLahman.get(lahmanId);
    if (!row) { out.push(`Regression enrichment missing: ${lahmanId}`); continue; }
    if ((row.advanced.ops != null) !== expectOps) out.push(`Regression OPS availability mismatch: ${lahmanId}`);
    if (row.achievements.hallOfFame.inducted !== expectHall) out.push(`Regression Hall of Fame mismatch: ${lahmanId}`);
  }
}

function parseCsv(textValue) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < textValue.length; i += 1) {
    const char = textValue[i];
    if (quoted) {
      if (char === '"' && textValue[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const [headers = [], ...values] = rows.filter(candidate => candidate.some(cell => cell !== ''));
  return values.map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function readJson(path) { const textValue = readFileSync(path, 'utf8'); return { path, text: textValue, value: JSON.parse(textValue) }; }
function readText(path) { if (!existsSync(path)) throw new Error(`Missing required enrichment source: ${path}`); return { path, text: readFileSync(path, 'utf8') }; }
function manifestJson(input) { return { path: relativePath(input.path), schemaVersion: input.value.schemaVersion ?? null, sha256: sha256(input.text) }; }
function relativePath(path) { return path.replace(`${resolve(packageDir, '../..')}/`, ''); }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function allKnown(values) { return values.every(value => value !== null && value !== undefined); }
function integer(value) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isInteger(parsed) ? parsed : null; }
function text(value) { const result = String(value ?? '').trim(); return result || null; }
function group(rows, fn) { const map = new Map(); for (const row of rows) { const key = fn(row); const list = map.get(key) ?? []; list.push(row); map.set(key, list); } return map; }
function uniqueIndex(rows, fn, label, out = null) { const map = new Map(); for (const row of rows) { const key = fn(row); if (!key) { if (out) out.push(`Missing ${label} key`); else throw new Error(`Missing ${label} key`); continue; } if (map.has(key)) { if (out) out.push(`Duplicate ${label}: ${key}`); else throw new Error(`Duplicate ${label}: ${key}`); } else map.set(key, row); } return map; }
function renderMarkdown(summary, issues) { return `# Canonical Career Enrichment Report\n\n- Career cards: ${summary.careerCardCount}\n- Enrichments: ${summary.enrichmentCount}\n- Careers with OPS: ${summary.opsCount}\n- Inducted Hall of Fame players: ${summary.inductedHallOfFameCount}\n- Critical issues: ${summary.criticalIssueCount}\n\n${issues.length ? issues.map(issue => `- ${issue}`).join('\n') : 'No critical issues.'}\n`; }
