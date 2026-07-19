import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const universeDir = resolve(packageDir, 'reports/canonical-universe');
const careerDir = resolve(packageDir, 'reports/canonical-career-aggregates');
const seasonCardDir = resolve(packageDir, 'reports/canonical-season-cards');
const outputDir = resolve(packageDir, 'reports/canonical-career-cards');
const strict = process.argv.includes('--strict');

const inputs = {
  universe: read(resolve(universeDir, 'canonical-player-universe.json')),
  batting: read(resolve(careerDir, 'batting-careers.json')),
  pitching: read(resolve(careerDir, 'pitching-careers.json')),
  appearances: read(resolve(careerDir, 'appearance-careers.json')),
  seasonCards: read(resolve(seasonCardDir, 'season-cards.json')),
};

const players = inputs.universe.value.players ?? [];
const battingById = uniqueIndex(inputs.batting.value.facts ?? [], row => row.playerId, 'batting career');
const pitchingById = uniqueIndex(inputs.pitching.value.facts ?? [], row => row.playerId, 'pitching career');
const appearanceById = uniqueIndex(inputs.appearances.value.facts ?? [], row => row.playerId, 'appearance career');
const seasonCardsById = group(inputs.seasonCards.value.cards ?? [], row => row.playerId);
const issues = [];

const cards = players
  .map(player => buildCard(player))
  .filter(Boolean)
  .sort((a, b) => a.playerId.localeCompare(b.playerId));

validate(cards, issues);
regression(cards, issues);

const sourceManifest = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, {
  path: input.path,
  schemaVersion: input.value.schemaVersion ?? null,
  sha256: sha256(input.text),
}]));
const summary = {
  playerCount: players.length,
  careerCardCount: cards.length,
  hitterCardCount: cards.filter(card => card.playerType === 'hitter' || card.playerType === 'two-way').length,
  pitcherCardCount: cards.filter(card => card.playerType === 'pitcher' || card.playerType === 'two-way').length,
  twoWayCardCount: cards.filter(card => card.playerType === 'two-way').length,
  criticalIssueCount: issues.length,
};

mkdirSync(outputDir, { recursive: true });
write('career-cards.json', { schemaVersion: 1, sourceManifest, cards });
write('canonical-career-cards-report.json', { schemaVersion: 1, sourceManifest, summary, criticalIssues: issues });
writeFileSync(resolve(outputDir, 'canonical-career-cards-report.md'), renderMarkdown(summary, issues));
console.log(`Built ${cards.length} canonical career cards. Critical issues: ${issues.length}.`);
if (strict && issues.length) process.exitCode = 1;

function buildCard(player) {
  const batting = battingById.get(player.canonicalId) ?? null;
  const pitching = pitchingById.get(player.canonicalId) ?? null;
  const appearances = appearanceById.get(player.canonicalId) ?? null;
  const seasons = [...(seasonCardsById.get(player.canonicalId) ?? [])].sort((a, b) => a.season - b.season);
  if (!batting && !pitching && !appearances && seasons.length === 0) return null;

  const playerType = batting && pitching ? 'two-way' : pitching ? 'pitcher' : 'hitter';
  const firstSeason = minKnown([batting?.firstSeason, pitching?.firstSeason, appearances?.firstSeason, seasons[0]?.season]);
  const lastSeason = maxKnown([batting?.lastSeason, pitching?.lastSeason, appearances?.lastSeason, seasons.at(-1)?.season]);
  const teamIds = [...new Set([
    ...(batting?.teamIds ?? []),
    ...(pitching?.teamIds ?? []),
    ...(appearances?.teamIds ?? []),
    ...seasons.flatMap(card => card.teamIds ?? []),
  ])].sort();

  return {
    schemaVersion: 1,
    playerId: player.canonicalId,
    lahmanPlayerId: player.lahmanPlayerId,
    identity: {
      displayName: player.displayName,
      legalName: player.legalName,
      aliases: [...(player.aliases ?? [])],
      isHallOfFamer: Boolean(player.isHallOfFamer),
    },
    playerType,
    career: {
      firstSeason,
      lastSeason,
      seasonCount: new Set(seasons.map(card => card.season)).size,
      teamIds,
      primaryPosition: primaryPosition(appearances),
    },
    summary: {
      batting: batting ? battingSummary(batting) : null,
      pitching: pitching ? pitchingSummary(pitching) : null,
      advanced: {
        war: null,
        ops: batting ? deriveOpsUnavailable() : null,
        opsPlus: null,
        eraPlus: null,
        fip: null,
      },
    },
    achievements: {
      hallOfFame: Boolean(player.isHallOfFamer),
      awards: null,
      allStarSelections: null,
      leagueLeaders: null,
    },
    seasonRefs: seasons.map(card => ({
      season: card.season,
      teamIds: [...(card.teamIds ?? [])],
      hasBatting: Boolean(card.batting),
      hasPitching: Boolean(card.pitching),
      hasPositions: Boolean(card.positions),
    })),
    provenance: {
      hasBattingCareer: Boolean(batting),
      hasPitchingCareer: Boolean(pitching),
      hasAppearanceCareer: Boolean(appearances),
      seasonCardCount: seasons.length,
    },
  };
}

function battingSummary(row) {
  return {
    atBats: row.atBats,
    runs: row.runs,
    hits: row.hits,
    doubles: row.doubles,
    triples: row.triples,
    homeRuns: row.homeRuns,
    runsBattedIn: row.runsBattedIn,
    stolenBases: row.stolenBases,
    walks: row.walks,
    battingAverage: divide(row.hits, row.atBats),
    sluggingPercentage: slugging(row),
  };
}

function pitchingSummary(row) {
  return {
    wins: row.wins,
    losses: row.losses,
    saves: row.saves,
    outsPitched: row.outsPitched,
    hitsAllowed: row.hitsAllowed,
    earnedRuns: row.earnedRuns,
    walksAllowed: row.walksAllowed,
    strikeouts: row.strikeouts,
    earnedRunAverage: ratePerNine(row.earnedRuns, row.outsPitched),
    whip: allKnown([row.walksAllowed, row.hitsAllowed, row.outsPitched]) && row.outsPitched > 0
      ? ((row.walksAllowed + row.hitsAllowed) * 3) / row.outsPitched
      : null,
  };
}

function primaryPosition(row) {
  if (!row) return null;
  const positions = [
    ['P', 'gamesPitcher'], ['C', 'gamesCatcher'], ['1B', 'gamesFirstBase'], ['2B', 'gamesSecondBase'],
    ['3B', 'gamesThirdBase'], ['SS', 'gamesShortstop'], ['LF', 'gamesLeftField'], ['CF', 'gamesCenterField'],
    ['RF', 'gamesRightField'], ['DH', 'gamesDesignatedHitter'],
  ];
  const known = positions
    .map(([label, field]) => ({ label, value: row[field] }))
    .filter(item => Number.isInteger(item.value));
  if (!known.length) return null;
  return known.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))[0].label;
}

function validate(cards, out) {
  const cardById = uniqueIndex(cards, card => card.playerId, 'career card', out);
  const playerById = uniqueIndex(players, player => player.canonicalId, 'canonical player');
  const expectedIds = new Set([
    ...battingById.keys(), ...pitchingById.keys(), ...appearanceById.keys(), ...seasonCardsById.keys(),
  ]);
  for (const id of expectedIds) if (!cardById.has(id)) out.push(`Missing career card: ${id}`);
  for (const card of cards) {
    const player = playerById.get(card.playerId);
    if (!player) out.push(`Unknown player: ${card.playerId}`);
    else if (player.lahmanPlayerId !== card.lahmanPlayerId) out.push(`Identity mismatch: ${card.playerId}`);
    if (card.career.firstSeason != null && card.career.lastSeason != null && card.career.firstSeason > card.career.lastSeason) out.push(`Invalid range: ${card.playerId}`);
    if (card.career.seasonCount !== card.seasonRefs.length) out.push(`Season reference count mismatch: ${card.playerId}`);
    const years = card.seasonRefs.map(ref => ref.season);
    if (new Set(years).size !== years.length) out.push(`Duplicate season reference: ${card.playerId}`);
    const sorted = [...years].sort((a, b) => a - b);
    if (JSON.stringify(years) !== JSON.stringify(sorted)) out.push(`Unsorted season references: ${card.playerId}`);
    if (card.summary.advanced.war !== null || card.summary.advanced.opsPlus !== null || card.summary.advanced.eraPlus !== null || card.summary.advanced.fip !== null) out.push(`Unsupported advanced value populated: ${card.playerId}`);
  }
}

function regression(cards, out) {
  const byLahman = new Map(cards.map(card => [card.lahmanPlayerId, card]));
  const tests = [
    ['ortizda01', 'David Ortiz', 'hitter'],
    ['riverma01', 'Mariano Rivera', 'pitcher'],
    ['ohtansh01', 'Shohei Ohtani', 'two-way'],
    ['griffke02', 'Ken Griffey Jr.', 'hitter'],
  ];
  for (const [lahmanId, name, playerType] of tests) {
    const card = byLahman.get(lahmanId);
    if (!card) out.push(`Regression card missing: ${lahmanId}`);
    else {
      if (card.identity.displayName !== name) out.push(`Regression name mismatch: ${lahmanId}`);
      if (card.playerType !== playerType) out.push(`Regression type mismatch: ${lahmanId}`);
    }
  }
}

function deriveOpsUnavailable() { return null; }
function slugging(row) {
  if (!allKnown([row.hits, row.doubles, row.triples, row.homeRuns, row.atBats]) || row.atBats <= 0) return null;
  const totalBases = row.hits + row.doubles + (2 * row.triples) + (3 * row.homeRuns);
  return totalBases / row.atBats;
}
function divide(numerator, denominator) { return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0 ? numerator / denominator : null; }
function ratePerNine(value, outs) { return Number.isFinite(value) && Number.isFinite(outs) && outs > 0 ? (value * 27) / outs : null; }
function allKnown(values) { return values.every(value => value !== null && value !== undefined); }
function minKnown(values) { const known = values.filter(Number.isInteger); return known.length ? Math.min(...known) : null; }
function maxKnown(values) { const known = values.filter(Number.isInteger); return known.length ? Math.max(...known) : null; }
function read(path) { const text = readFileSync(path, 'utf8'); return { path, text, value: JSON.parse(text) }; }
function write(name, value) { writeFileSync(resolve(outputDir, name), `${JSON.stringify(value, null, 2)}\n`); }
function sha256(text) { return createHash('sha256').update(text).digest('hex'); }
function group(rows, fn) { const map = new Map(); for (const row of rows) { const key = fn(row); const list = map.get(key) ?? []; list.push(row); map.set(key, list); } return map; }
function uniqueIndex(rows, fn, label, out = null) { const map = new Map(); for (const row of rows) { const key = fn(row); if (!key) { if (out) out.push(`Missing ${label} key`); else throw new Error(`Missing ${label} key`); continue; } if (map.has(key)) { if (out) out.push(`Duplicate ${label}: ${key}`); else throw new Error(`Duplicate ${label}: ${key}`); } else map.set(key, row); } return map; }
function renderMarkdown(summary, issues) { return `# Canonical Career Cards Report\n\n- Career cards: ${summary.careerCardCount}\n- Hitter-capable cards: ${summary.hitterCardCount}\n- Pitcher-capable cards: ${summary.pitcherCardCount}\n- Two-way cards: ${summary.twoWayCardCount}\n- Critical issues: ${summary.criticalIssueCount}\n\n${issues.length ? issues.map(issue => `- ${issue}`).join('\n') : 'No critical issues.'}\n`; }
