import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const UNIVERSE_DIR = resolve(PACKAGE_DIR, 'reports/canonical-universe');
const AGGREGATE_DIR = resolve(PACKAGE_DIR, 'reports/canonical-season-aggregates');
const OUTPUT_DIR = resolve(PACKAGE_DIR, 'reports/canonical-season-cards');
const strict = process.argv.includes('--strict');

const inputs = {
  universe: readArtifact(resolve(UNIVERSE_DIR, 'canonical-player-universe.json')),
  batting: readArtifact(resolve(AGGREGATE_DIR, 'batting-seasons.json')),
  pitching: readArtifact(resolve(AGGREGATE_DIR, 'pitching-seasons.json')),
  appearances: readArtifact(resolve(AGGREGATE_DIR, 'appearance-seasons.json')),
};

const players = inputs.universe.artifact.players ?? [];
const knownPlayerIds = new Set(players.map((player) => player.canonicalId));
const battingByKey = indexFacts(inputs.batting.artifact.facts ?? [], 'batting');
const pitchingByKey = indexFacts(inputs.pitching.artifact.facts ?? [], 'pitching');
const appearanceByKey = indexFacts(inputs.appearances.artifact.facts ?? [], 'appearances');
const keys = [...new Set([...battingByKey.keys(), ...pitchingByKey.keys(), ...appearanceByKey.keys()])].sort(compareKeys);

const cards = keys.map((key) => buildCard({
  key,
  batting: battingByKey.get(key) ?? null,
  pitching: pitchingByKey.get(key) ?? null,
  appearances: appearanceByKey.get(key) ?? null,
}));

const validation = validate(cards, knownPlayerIds);
const coverage = buildCoverage(cards);
const sourceManifest = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, {
  path: input.path,
  sha256: sha256(input.text),
  schemaVersion: input.artifact.schemaVersion ?? null,
}]));

mkdirSync(OUTPUT_DIR, { recursive: true });
writeJson('season-cards.json', { schemaVersion: 1, sourceManifest, cards });
writeJson('season-card-coverage.json', { schemaVersion: 1, sourceManifest, ...coverage });
writeJson('season-card-report.json', { schemaVersion: 1, sourceManifest, ...validation, coverageSummary: coverage.summary });
writeFileSync(resolve(OUTPUT_DIR, 'season-card-report.md'), renderMarkdown(validation, coverage));

console.log(`Built ${cards.length} canonical season cards. Critical issues: ${validation.summary.criticalIssueCount}.`);
if (strict && validation.summary.criticalIssueCount > 0) process.exitCode = 1;

function buildCard({ key, batting, pitching, appearances }) {
  const identityRows = [batting, pitching, appearances].filter(Boolean);
  const first = identityRows[0];
  const conflictingLahmanIds = [...new Set(identityRows.map((row) => row.lahmanPlayerId))];
  const teamIds = [...new Set(identityRows.flatMap((row) => row.teamIds ?? []))].sort();

  return {
    schemaVersion: 1,
    playerId: first.playerId,
    lahmanPlayerId: conflictingLahmanIds.length === 1 ? conflictingLahmanIds[0] : null,
    season: first.season,
    teamIds,
    positions: appearances ? pick(appearances, [
      'gamesAll', 'gamesPitcher', 'gamesCatcher', 'gamesFirstBase', 'gamesSecondBase',
      'gamesThirdBase', 'gamesShortstop', 'gamesLeftField', 'gamesCenterField',
      'gamesRightField', 'gamesDesignatedHitter',
    ]) : null,
    batting: batting ? buildBatting(batting) : null,
    pitching: pitching ? buildPitching(pitching) : null,
    provenance: {
      aggregateKey: key,
      hasBattingAggregate: Boolean(batting),
      hasPitchingAggregate: Boolean(pitching),
      hasAppearanceAggregate: Boolean(appearances),
      conflictingLahmanIds,
    },
  };
}

function buildBatting(row) {
  const direct = pick(row, [
    'atBats', 'runs', 'hits', 'doubles', 'triples', 'homeRuns', 'runsBattedIn',
    'stolenBases', 'walks', 'hitByPitch', 'sacrificeFlies',
  ]);
  const totalBases = allKnown(row, ['hits', 'doubles', 'triples', 'homeRuns'])
    ? row.hits + row.doubles + (2 * row.triples) + (3 * row.homeRuns)
    : null;
  return {
    ...direct,
    battingAverage: divide(row.hits, row.atBats),
    totalBases,
    sluggingPercentage: divide(totalBases, row.atBats),
  };
}

function buildPitching(row) {
  const direct = pick(row, [
    'wins', 'losses', 'saves', 'outsPitched', 'hitsAllowed', 'earnedRuns',
    'walksAllowed', 'strikeouts',
  ]);
  return {
    ...direct,
    earnedRunAverage: ratePerNine(row.earnedRuns, row.outsPitched),
    whip: allKnown(row, ['walksAllowed', 'hitsAllowed', 'outsPitched']) && row.outsPitched > 0
      ? ((row.walksAllowed + row.hitsAllowed) * 3) / row.outsPitched
      : null,
    strikeoutsPerNine: ratePerNine(row.strikeouts, row.outsPitched),
    walksPerNine: ratePerNine(row.walksAllowed, row.outsPitched),
    strikeoutWalkRatio: allKnown(row, ['strikeouts', 'walksAllowed']) && row.walksAllowed > 0
      ? row.strikeouts / row.walksAllowed
      : null,
  };
}

function validate(cards, knownPlayerIds) {
  const criticalIssues = [];
  const seen = new Set();
  for (const card of cards) {
    const key = seasonKey(card);
    if (seen.has(key)) criticalIssues.push(`Duplicate season card: ${key}`);
    seen.add(key);
    if (!knownPlayerIds.has(card.playerId)) criticalIssues.push(`Unknown canonical player: ${card.playerId}`);
    if (!Number.isInteger(card.season)) criticalIssues.push(`Invalid season: ${key}`);
    if (card.provenance.conflictingLahmanIds.length !== 1) criticalIssues.push(`Conflicting Lahman IDs: ${key}`);
    if (card.batting) {
      validateCounts(card.batting, key, criticalIssues);
      if (card.batting.hits !== null && card.batting.atBats !== null && card.batting.hits > card.batting.atBats) criticalIssues.push(`Hits exceed at-bats: ${key}`);
      if (allKnown(card.batting, ['doubles', 'triples', 'homeRuns', 'hits']) && card.batting.doubles + card.batting.triples + card.batting.homeRuns > card.batting.hits) criticalIssues.push(`Extra-base hits exceed hits: ${key}`);
      reconcileDerived(card.batting.battingAverage, divide(card.batting.hits, card.batting.atBats), `battingAverage ${key}`, criticalIssues);
      reconcileDerived(card.batting.sluggingPercentage, divide(card.batting.totalBases, card.batting.atBats), `sluggingPercentage ${key}`, criticalIssues);
    }
    if (card.pitching) {
      validateCounts(card.pitching, key, criticalIssues);
      reconcileDerived(card.pitching.earnedRunAverage, ratePerNine(card.pitching.earnedRuns, card.pitching.outsPitched), `ERA ${key}`, criticalIssues);
      reconcileDerived(card.pitching.strikeoutsPerNine, ratePerNine(card.pitching.strikeouts, card.pitching.outsPitched), `K/9 ${key}`, criticalIssues);
    }
  }
  return { summary: { cardCount: cards.length, criticalIssueCount: criticalIssues.length }, criticalIssues };
}

function buildCoverage(cards) {
  const fields = {};
  const register = (path, value, source) => {
    const entry = fields[path] ?? { relevant: 0, known: 0, zero: 0, unknown: 0, direct: 0, derived: 0 };
    entry.relevant += 1;
    if (value === null || value === undefined) entry.unknown += 1;
    else { entry.known += 1; if (value === 0) entry.zero += 1; entry[source] += 1; }
    fields[path] = entry;
  };
  for (const card of cards) {
    if (card.batting) for (const [field, value] of Object.entries(card.batting)) register(`batting.${field}`, value, ['battingAverage','totalBases','sluggingPercentage'].includes(field) ? 'derived' : 'direct');
    if (card.pitching) for (const [field, value] of Object.entries(card.pitching)) register(`pitching.${field}`, value, ['earnedRunAverage','whip','strikeoutsPerNine','walksPerNine','strikeoutWalkRatio'].includes(field) ? 'derived' : 'direct');
    if (card.positions) for (const [field, value] of Object.entries(card.positions)) register(`positions.${field}`, value, 'direct');
  }
  const unsupportedFields = [
    'batting.games','batting.plateAppearances','batting.caughtStealing','batting.strikeouts','batting.sacrificeHits','batting.groundedIntoDoublePlays','batting.onBasePercentage','batting.ops','batting.opsPlus',
    'pitching.games','pitching.gamesStarted','pitching.completeGames','pitching.shutouts','pitching.eraPlus','pitching.fip','war','leagueLeaderFlags','allStarSelections','awards','awardVotingFinishes','leagueIds',
  ].map((field) => ({ field, status: 'unsupported-current-source' }));
  return { summary: { cardCount: cards.length, fieldCount: Object.keys(fields).length, unsupportedFieldCount: unsupportedFields.length }, fields, unsupportedFields };
}

function validateCounts(section, key, issues) {
  for (const [field, value] of Object.entries(section)) {
    if (value === null || ['battingAverage','sluggingPercentage','earnedRunAverage','whip','strikeoutsPerNine','walksPerNine','strikeoutWalkRatio'].includes(field)) continue;
    if (!Number.isInteger(value) || value < 0) issues.push(`Invalid counting statistic ${field} for ${key}: ${value}`);
  }
}
function reconcileDerived(actual, expected, label, issues) { if (actual === null && expected === null) return; if (actual === null || expected === null || Math.abs(actual - expected) > 1e-12) issues.push(`Derived reconciliation failed: ${label}`); }
function ratePerNine(numerator, outs) { return allKnown({ numerator, outs }, ['numerator','outs']) && outs > 0 ? (numerator * 27) / outs : null; }
function divide(numerator, denominator) { return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0 ? numerator / denominator : null; }
function allKnown(object, fields) { return fields.every((field) => object[field] !== null && object[field] !== undefined && Number.isFinite(object[field])); }
function pick(object, fields) { return Object.fromEntries(fields.map((field) => [field, object[field] ?? null])); }
function seasonKey(row) { return `${row.playerId}:${row.season}`; }
function compareKeys(a, b) { const [ap, ay] = a.split(':'); const [bp, by] = b.split(':'); return ap.localeCompare(bp) || Number(ay) - Number(by); }
function indexFacts(facts, label) { const map = new Map(); for (const fact of facts) { const key = seasonKey(fact); if (map.has(key)) throw new Error(`Duplicate ${label} input key: ${key}`); map.set(key, fact); } return map; }
function readArtifact(path) { const text = readFileSync(path, 'utf8'); return { path: relativePath(path), text, artifact: JSON.parse(text) }; }
function relativePath(path) { return path.slice(resolve(PACKAGE_DIR, '../..').length + 1).replaceAll('\\', '/'); }
function sha256(text) { return createHash('sha256').update(text).digest('hex'); }
function writeJson(filename, value) { writeFileSync(resolve(OUTPUT_DIR, filename), `${JSON.stringify(value, null, 2)}\n`); }
function renderMarkdown(validation, coverage) { return `# Canonical Season Card Report\n\n- Cards: ${validation.summary.cardCount}\n- Covered fields: ${coverage.summary.fieldCount}\n- Unsupported fields tracked: ${coverage.summary.unsupportedFieldCount}\n- Critical issues: ${validation.summary.criticalIssueCount}\n\n## Critical issues\n\n${validation.criticalIssues.length ? validation.criticalIssues.map((issue) => `- ${issue}`).join('\n') : '- None'}\n`; }
