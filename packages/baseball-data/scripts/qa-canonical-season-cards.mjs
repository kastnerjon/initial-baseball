import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UNIVERSE_DIR = resolve(PACKAGE_DIR, 'reports/canonical-universe');
const AGGREGATE_DIR = resolve(PACKAGE_DIR, 'reports/canonical-season-aggregates');
const CARD_DIR = resolve(PACKAGE_DIR, 'reports/canonical-season-cards');

const universe = JSON.parse(readFileSync(resolve(UNIVERSE_DIR, 'canonical-player-universe.json'), 'utf8')).players ?? [];
const batting = readFacts(resolve(AGGREGATE_DIR, 'batting-seasons.json'));
const pitching = readFacts(resolve(AGGREGATE_DIR, 'pitching-seasons.json'));
const appearances = readFacts(resolve(AGGREGATE_DIR, 'appearance-seasons.json'));
const cards = JSON.parse(readFileSync(resolve(CARD_DIR, 'season-cards.json'), 'utf8')).cards ?? [];
const issues = [];

const playerByCanonicalId = uniqueIndex(universe, (player) => player.canonicalId, 'canonical player ID');
const playerByLahmanId = uniqueIndex(universe, (player) => player.lahmanPlayerId, 'Lahman player ID');
validateExternalIdOwnership(universe);

const battingByKey = indexSeasons(batting, 'batting');
const pitchingByKey = indexSeasons(pitching, 'pitching');
const appearancesByKey = indexSeasons(appearances, 'appearances');
const cardsByKey = indexSeasons(cards, 'cards');
const expectedKeys = new Set([...battingByKey.keys(), ...pitchingByKey.keys(), ...appearancesByKey.keys()]);

for (const [family, rows] of [['batting', batting], ['pitching', pitching], ['appearances', appearances]]) {
  for (const row of rows) validateRowIdentity(row, family);
}

if (cardsByKey.size !== expectedKeys.size) issues.push(`Card count ${cardsByKey.size} does not match expected player-season count ${expectedKeys.size}`);
for (const key of expectedKeys) {
  const card = cardsByKey.get(key);
  if (!card) { issues.push(`Missing card ${key}`); continue; }
  validateCardIdentity(card, key);
  compareIdentity(card, battingByKey.get(key), pitchingByKey.get(key), appearancesByKey.get(key), key);
  compareSection(card.batting, battingByKey.get(key), [
    'atBats','runs','hits','doubles','triples','homeRuns','runsBattedIn','stolenBases','walks','hitByPitch','sacrificeFlies',
  ], `batting ${key}`);
  compareSection(card.pitching, pitchingByKey.get(key), [
    'wins','losses','saves','outsPitched','hitsAllowed','earnedRuns','walksAllowed','strikeouts',
  ], `pitching ${key}`);
  compareSection(card.positions, appearancesByKey.get(key), [
    'gamesAll','gamesPitcher','gamesCatcher','gamesFirstBase','gamesSecondBase','gamesThirdBase','gamesShortstop','gamesLeftField','gamesCenterField','gamesRightField','gamesDesignatedHitter',
  ], `positions ${key}`);
  verifyDerived(card, key);
}
for (const key of cardsByKey.keys()) if (!expectedKeys.has(key)) issues.push(`Unexpected card ${key}`);

const regressionCases = [
  ['ortizda01', 2004, { batting: { atBats: 582, hits: 175, doubles: 47, triples: 3, homeRuns: 41, runsBattedIn: 139 }, teamIds: ['BOS'] }],
  ['aaronha01', 1957, { batting: { atBats: 615, hits: 198, homeRuns: 44, runsBattedIn: 132 }, teamIds: ['ML1'] }],
  ['bettsmo01', 2018, { batting: { atBats: 520, hits: 180, homeRuns: 32, stolenBases: 30 }, teamIds: ['BOS'] }],
  ['riverma01', 2005, { pitching: { wins: 7, losses: 4, saves: 43, outsPitched: 235, earnedRuns: 12 }, teamIds: ['NYA'] }],
  ['martipe02', 2000, { pitching: { wins: 18, losses: 6, outsPitched: 651, strikeouts: 284, earnedRuns: 42 }, teamIds: ['BOS'] }],
  ['ohtansh01', 2021, { batting: { homeRuns: 46 }, pitching: { wins: 9, strikeouts: 156 }, teamIds: ['LAA'] }],
];
for (const [lahmanPlayerId, season, expected] of regressionCases) {
  const player = playerByLahmanId.get(lahmanPlayerId);
  if (!player) { issues.push(`Regression player missing from universe: ${lahmanPlayerId}`); continue; }
  const card = cardsByKey.get(`${player.canonicalId}:${season}`);
  if (!card) { issues.push(`Regression card missing: ${lahmanPlayerId}:${season}`); continue; }
  if (card.lahmanPlayerId !== lahmanPlayerId) issues.push(`Regression identity mismatch: ${lahmanPlayerId}:${season}`);
  compareExpected(card, expected, `${lahmanPlayerId}:${season}`);
}

console.log(`QA checked ${cards.length} season cards against ${universe.length} canonical players, ${batting.length} batting, ${pitching.length} pitching, and ${appearances.length} appearance aggregates.`);
console.log(`Regression cases checked: ${regressionCases.length}. Issues: ${issues.length}.`);
if (issues.length) {
  console.error(issues.slice(0, 100).join('\n'));
  if (issues.length > 100) console.error(`...and ${issues.length - 100} more`);
  process.exitCode = 1;
}

function validateExternalIdOwnership(players) {
  const owners = new Map();
  for (const player of players) {
    for (const mapping of player.sourceMappings ?? []) {
      const externalKey = `${mapping.source}:${mapping.externalId}`;
      const owner = owners.get(externalKey);
      if (owner && owner !== player.canonicalId) issues.push(`External ID ${externalKey} belongs to both ${owner} and ${player.canonicalId}`);
      else owners.set(externalKey, player.canonicalId);
    }
  }
}

function validateRowIdentity(row, family) {
  const player = playerByCanonicalId.get(row.playerId);
  if (!player) { issues.push(`${family} row has unknown canonical player ${row.playerId}:${row.season}`); return; }
  if (row.lahmanPlayerId !== player.lahmanPlayerId) issues.push(`${family} identity crosswalk mismatch ${row.playerId}:${row.season}: ${row.lahmanPlayerId} != ${player.lahmanPlayerId}`);
  validateCareerRange(player, row.season, `${family} ${row.playerId}:${row.season}`);
}

function validateCardIdentity(card, key) {
  const player = playerByCanonicalId.get(card.playerId);
  if (!player) { issues.push(`Card ${key} has unknown canonical player`); return; }
  if (card.lahmanPlayerId !== player.lahmanPlayerId) issues.push(`Card ${key} Lahman ID ${card.lahmanPlayerId} does not belong to canonical player ${card.playerId}`);
  validateCareerRange(player, card.season, `card ${key}`);
}

function validateCareerRange(player, season, label) {
  if (Number.isInteger(player.firstYear) && season < player.firstYear) issues.push(`${label} predates ${player.displayName}'s debut year ${player.firstYear}`);
  if (Number.isInteger(player.lastYear) && season > player.lastYear) issues.push(`${label} follows ${player.displayName}'s final year ${player.lastYear}`);
}

function verifyDerived(card, key) {
  if (card.batting) {
    const b = card.batting;
    exact(b.battingAverage, ratio(b.hits, b.atBats), `AVG ${key}`);
    const totalBases = known(b.hits, b.doubles, b.triples, b.homeRuns) ? b.hits + b.doubles + 2*b.triples + 3*b.homeRuns : null;
    exact(b.totalBases, totalBases, `TB ${key}`);
    exact(b.sluggingPercentage, ratio(totalBases, b.atBats), `SLG ${key}`);
  }
  if (card.pitching) {
    const p = card.pitching;
    exact(p.earnedRunAverage, perNine(p.earnedRuns, p.outsPitched), `ERA ${key}`);
    exact(p.whip, known(p.walksAllowed, p.hitsAllowed, p.outsPitched) && p.outsPitched > 0 ? 3*(p.walksAllowed+p.hitsAllowed)/p.outsPitched : null, `WHIP ${key}`);
    exact(p.strikeoutsPerNine, perNine(p.strikeouts, p.outsPitched), `K9 ${key}`);
    exact(p.walksPerNine, perNine(p.walksAllowed, p.outsPitched), `BB9 ${key}`);
    exact(p.strikeoutWalkRatio, known(p.strikeouts, p.walksAllowed) && p.walksAllowed > 0 ? p.strikeouts/p.walksAllowed : null, `KBB ${key}`);
  }
}

function compareIdentity(card, ...rowsAndKey) {
  const key = rowsAndKey.pop();
  const rows = rowsAndKey.filter(Boolean);
  const canonicalIds = [...new Set(rows.map((row) => row.playerId))];
  const lahmanIds = [...new Set(rows.map((row) => row.lahmanPlayerId))];
  if (canonicalIds.length !== 1 || card.playerId !== canonicalIds[0]) issues.push(`Canonical identity mismatch ${key}`);
  if (lahmanIds.length !== 1 || card.lahmanPlayerId !== lahmanIds[0]) issues.push(`Lahman identity mismatch ${key}`);
  const teams = [...new Set(rows.flatMap((row) => row.teamIds ?? []))].sort();
  if (JSON.stringify(card.teamIds) !== JSON.stringify(teams)) issues.push(`Team mismatch ${key}`);
}

function compareSection(actual, source, fields, label) {
  if (!source) { if (actual !== null) issues.push(`Unexpected ${label}`); return; }
  if (!actual) { issues.push(`Missing ${label}`); return; }
  for (const field of fields) if (actual[field] !== source[field]) issues.push(`${label}.${field}: ${actual[field]} != ${source[field]}`);
}
function compareExpected(actual, expected, label) {
  if (expected.teamIds && JSON.stringify(actual.teamIds) !== JSON.stringify(expected.teamIds)) issues.push(`${label} teamIds regression`);
  for (const section of ['batting','pitching']) for (const [field, value] of Object.entries(expected[section] ?? {})) if (actual[section]?.[field] !== value) issues.push(`${label} ${section}.${field} regression`);
}
function exact(actual, expected, label) { if (actual === null && expected === null) return; if (actual === null || expected === null || Math.abs(actual-expected) > 1e-12) issues.push(`${label}: ${actual} != ${expected}`); }
function perNine(value, outs) { return known(value, outs) && outs > 0 ? value*27/outs : null; }
function ratio(value, denominator) { return known(value, denominator) && denominator > 0 ? value/denominator : null; }
function known(...values) { return values.every((value) => Number.isFinite(value)); }
function seasonKey(row) { return `${row.playerId}:${row.season}`; }
function indexSeasons(rows, label) { return uniqueIndex(rows, seasonKey, `${label} key`); }
function uniqueIndex(rows, keyFn, label) { const map = new Map(); for (const row of rows) { const key = keyFn(row); if (!key) { issues.push(`Missing ${label}`); continue; } if (map.has(key)) issues.push(`Duplicate ${label} ${key}`); else map.set(key, row); } return map; }
function readFacts(path) { return JSON.parse(readFileSync(path, 'utf8')).facts ?? []; }
