import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AGGREGATE_DIR = resolve(PACKAGE_DIR, 'reports/canonical-season-aggregates');
const CARD_DIR = resolve(PACKAGE_DIR, 'reports/canonical-season-cards');

const batting = readFacts(resolve(AGGREGATE_DIR, 'batting-seasons.json'));
const pitching = readFacts(resolve(AGGREGATE_DIR, 'pitching-seasons.json'));
const appearances = readFacts(resolve(AGGREGATE_DIR, 'appearance-seasons.json'));
const cards = JSON.parse(readFileSync(resolve(CARD_DIR, 'season-cards.json'), 'utf8')).cards ?? [];

const battingByKey = index(batting, 'batting');
const pitchingByKey = index(pitching, 'pitching');
const appearancesByKey = index(appearances, 'appearances');
const cardsByKey = index(cards, 'cards');
const expectedKeys = new Set([...battingByKey.keys(), ...pitchingByKey.keys(), ...appearancesByKey.keys()]);
const issues = [];

if (cardsByKey.size !== expectedKeys.size) issues.push(`Card count ${cardsByKey.size} does not match expected player-season count ${expectedKeys.size}`);
for (const key of expectedKeys) {
  const card = cardsByKey.get(key);
  if (!card) { issues.push(`Missing card ${key}`); continue; }
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
  const matches = cards.filter((card) => card.lahmanPlayerId === lahmanPlayerId && card.season === season);
  if (matches.length !== 1) { issues.push(`Regression case ${lahmanPlayerId}:${season} matched ${matches.length} cards`); continue; }
  compareExpected(matches[0], expected, `${lahmanPlayerId}:${season}`);
}

console.log(`QA checked ${cards.length} season cards against ${batting.length} batting, ${pitching.length} pitching, and ${appearances.length} appearance aggregates.`);
console.log(`Regression cases checked: ${regressionCases.length}. Issues: ${issues.length}.`);
if (issues.length) {
  console.error(issues.slice(0, 100).join('\n'));
  if (issues.length > 100) console.error(`...and ${issues.length - 100} more`);
  process.exitCode = 1;
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
  const lahmanIds = [...new Set(rows.map((row) => row.lahmanPlayerId))];
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
function key(row) { return `${row.playerId}:${row.season}`; }
function index(rows, label) { const map = new Map(); for (const row of rows) { const k = key(row); if (map.has(k)) throw new Error(`Duplicate ${label} key ${k}`); map.set(k, row); } return map; }
function readFacts(path) { return JSON.parse(readFileSync(path, 'utf8')).facts ?? []; }
