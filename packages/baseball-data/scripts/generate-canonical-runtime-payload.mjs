import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditTeamDisplayIdentityCoverage,
  buildTeamDisplayIdentityIndex,
  collapseCareerTeamDisplayIdentities,
  resolveTeamDisplayIdentities,
} from './team-display-identities.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(packageDir, 'reports/canonical-runtime-payload');
const shardDir = resolve(outputDir, 'reveal-shards');
const strict = process.argv.includes('--strict');

const inputs = {
  universe: readJson(resolve(packageDir, 'reports/canonical-universe/canonical-player-universe.json')),
  redirects: readJson(resolve(packageDir, 'reports/canonical-universe/canonical-player-redirects.json')),
  seasonCards: readJson(resolve(packageDir, 'reports/canonical-season-cards/season-cards.json')),
  seasonEnrichment: readJson(resolve(packageDir, 'reports/canonical-season-enrichment/season-enrichment.json')),
  careerCards: readJson(resolve(packageDir, 'reports/canonical-career-cards/career-cards.json')),
  careerEnrichment: readJson(resolve(packageDir, 'reports/canonical-career-enrichment/career-enrichment.json')),
};
const teamDisplaySource = readText(resolve(packageDir, 'data/lahman/Teams.csv'));
const teamDisplayIndex = buildTeamDisplayIdentityIndex(teamDisplaySource.text);
const seasonCards = inputs.seasonCards.value.cards ?? [];
const teamDisplayAudit = auditTeamDisplayIdentityCoverage({ seasons: seasonCards, index: teamDisplayIndex });

const universeById = uniqueIndex(inputs.universe.value.players ?? [], row => row.canonicalId, 'universe player');
const careerCards = inputs.careerCards.value.cards ?? [];
const careerById = uniqueIndex(careerCards, row => row.playerId, 'career card');
const careerEnrichmentById = uniqueIndex(inputs.careerEnrichment.value.enrichments ?? [], row => row.playerId, 'career enrichment');
const seasonCardsById = group(seasonCards, row => row.playerId);
const seasonEnrichmentByKey = uniqueIndex(inputs.seasonEnrichment.value.enrichments ?? [], seasonKey, 'season enrichment');
const issues = teamDisplayAudit.missing.map(key => `Missing team display identity: ${key}`);
const warnings = [];

const reveals = careerCards
  .map(card => buildReveal(card))
  .sort((a, b) => a.playerId.localeCompare(b.playerId));
const revealById = uniqueIndex(reveals, row => row.playerId, 'runtime reveal', issues);
const playerIndex = reveals
  .map(reveal => buildIndexEntry(reveal, universeById.get(reveal.playerId)))
  .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.playerId.localeCompare(b.playerId));

const allRedirects = inputs.redirects.value.redirects ?? {};
const runtimeRedirects = {};
const excludedRedirects = [];
for (const [legacyPlayerId, playerId] of Object.entries(allRedirects).sort(([a], [b]) => a.localeCompare(b))) {
  if (revealById.has(playerId)) runtimeRedirects[legacyPlayerId] = playerId;
  else excludedRedirects.push({ legacyPlayerId, playerId, reason: 'target_has_no_runtime_reveal' });
}
if (excludedRedirects.length) warnings.push(`${excludedRedirects.length} legacy redirects target players without runtime reveals.`);

validate({ reveals, playerIndex, runtimeRedirects, excludedRedirects, issues });
regression({ reveals, playerIndex, issues });

const sourceManifest = {
  ...Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, manifestJson(input)])),
  teams: manifestText(teamDisplaySource),
};
const shards = buildShards(reveals);
const shardManifest = [];

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(shardDir, { recursive: true });

for (const [shardId, records] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const path = resolve(shardDir, `${shardId}.json`);
  const value = {
    schemaVersion: 1,
    shardId,
    players: Object.fromEntries(records.map(record => [record.playerId, record])),
  };
  const text = servingJsonText(value);
  writeFileSync(path, text);
  shardManifest.push({
    shardId,
    path: `reveal-shards/${shardId}.json`,
    playerCount: records.length,
    byteCount: Buffer.byteLength(text),
    sha256: sha256(text),
  });
}

const summary = {
  universePlayerCount: universeById.size,
  runtimePlayerCount: reveals.length,
  runtimeSeasonCount: reveals.reduce((sum, reveal) => sum + reveal.seasons.length, 0),
  sourceTeamIdCount: teamDisplayAudit.sourceTeamIdCount,
  displayAbbreviationCount: teamDisplayAudit.displayAbbreviationCount,
  missingTeamDisplayIdentityCount: teamDisplayAudit.missing.length,
  shardCount: shardManifest.length,
  runtimeRedirectCount: Object.keys(runtimeRedirects).length,
  excludedRedirectCount: excludedRedirects.length,
  warningCount: warnings.length,
  criticalIssueCount: issues.length,
};

writeServingJson(resolve(outputDir, 'player-index.json'), { schemaVersion: 1, sourceManifest, players: playerIndex });
writeServingJson(resolve(outputDir, 'legacy-redirects.json'), { schemaVersion: 1, sourceManifest, redirects: runtimeRedirects, excludedRedirects });
writeServingJson(resolve(outputDir, 'reveal-shard-manifest.json'), { schemaVersion: 1, sourceManifest, shards: shardManifest });
writeJson(resolve(outputDir, 'canonical-runtime-payload-report.json'), { schemaVersion: 1, sourceManifest, summary, warnings, criticalIssues: issues });
writeFileSync(resolve(outputDir, 'canonical-runtime-payload-report.md'), renderMarkdown(summary, warnings, issues));

console.log(`Built ${summary.runtimePlayerCount} runtime players across ${summary.shardCount} reveal shards with ${summary.runtimeSeasonCount} season rows. Critical issues: ${issues.length}.`);
if (strict && issues.length) process.exitCode = 1;

function buildReveal(card) {
  const universe = universeById.get(card.playerId);
  const enrichment = careerEnrichmentById.get(card.playerId);
  const seasons = [...(seasonCardsById.get(card.playerId) ?? [])]
    .sort((a, b) => a.season - b.season)
    .map(seasonCard => {
      const seasonEnrichment = seasonEnrichmentByKey.get(seasonKey(seasonCard));
      return {
        season: seasonCard.season,
        teamIds: [...(seasonCard.teamIds ?? [])],
        teamIdentities: resolveTeamDisplayIdentities({
          season: seasonCard.season,
          teamIds: seasonCard.teamIds,
          index: teamDisplayIndex,
        }),
        positions: clone(seasonCard.positions),
        batting: clone(seasonCard.batting),
        pitching: clone(seasonCard.pitching),
        advanced: clone(seasonEnrichment?.advanced ?? null),
        achievements: clone(seasonEnrichment?.achievements ?? null),
      };
    });

  return {
    schemaVersion: 1,
    playerId: card.playerId,
    lahmanPlayerId: card.lahmanPlayerId,
    displayName: card.identity.displayName,
    playerType: card.playerType,
    career: {
      firstSeason: card.career.firstSeason,
      lastSeason: card.career.lastSeason,
      seasonCount: card.career.seasonCount,
      teamIds: [...(card.career.teamIds ?? [])],
      teamIdentities: collapseCareerTeamDisplayIdentities(seasons),
      primaryPosition: card.career.primaryPosition,
      batting: clone(card.summary.batting),
      pitching: clone(card.summary.pitching),
      advanced: clone(enrichment?.advanced ?? null),
      achievements: clone(enrichment?.achievements ?? null),
    },
    seasons,
    provenance: {
      canonicalUniversePresent: Boolean(universe),
      careerEnrichmentPresent: Boolean(enrichment),
      seasonCardCount: seasons.length,
      legalNameExcludedFromDisplayPayload: true,
    },
  };
}

function buildIndexEntry(reveal, universe) {
  return {
    playerId: reveal.playerId,
    lahmanPlayerId: reveal.lahmanPlayerId,
    displayName: reveal.displayName,
    aliases: [...(universe?.aliases ?? [])],
    playerType: reveal.playerType,
    primaryPosition: reveal.career.primaryPosition,
    firstSeason: reveal.career.firstSeason,
    lastSeason: reveal.career.lastSeason,
    seasonCount: reveal.career.seasonCount,
    teamIds: [...reveal.career.teamIds],
    teamIdentities: clone(reveal.career.teamIdentities),
    isHallOfFamer: Boolean(reveal.career.achievements?.hallOfFame?.inducted),
    revealShard: shardPath(reveal.playerId),
  };
}

function validate({ reveals, playerIndex, runtimeRedirects, excludedRedirects, issues: out }) {
  if (reveals.length !== careerCards.length) out.push(`Runtime reveal count ${reveals.length} != career card count ${careerCards.length}`);
  if (playerIndex.length !== reveals.length) out.push(`Player index count ${playerIndex.length} != runtime reveal count ${reveals.length}`);
  if (careerEnrichmentById.size !== careerById.size) out.push(`Career enrichment count ${careerEnrichmentById.size} != career card count ${careerById.size}`);
  if (seasonEnrichmentByKey.size !== seasonCards.length) out.push(`Season enrichment count ${seasonEnrichmentByKey.size} != season card count ${seasonCards.length}`);

  const indexById = uniqueIndex(playerIndex, row => row.playerId, 'runtime index', out);
  const seenSeasonKeys = new Set();
  for (const reveal of reveals) {
    const card = careerById.get(reveal.playerId);
    const universe = universeById.get(reveal.playerId);
    const enrichment = careerEnrichmentById.get(reveal.playerId);
    if (!card || !universe || !enrichment) out.push(`Incomplete runtime join: ${reveal.playerId}`);
    if (card?.lahmanPlayerId !== reveal.lahmanPlayerId || universe?.lahmanPlayerId !== reveal.lahmanPlayerId || enrichment?.lahmanPlayerId !== reveal.lahmanPlayerId) out.push(`Runtime identity mismatch: ${reveal.playerId}`);
    if (reveal.displayName !== card?.identity.displayName || reveal.displayName !== universe?.displayName) out.push(`Runtime display-name mismatch: ${reveal.playerId}`);
    if (Object.hasOwn(reveal, 'legalName') || Object.hasOwn(indexById.get(reveal.playerId) ?? {}, 'legalName')) out.push(`Legal name leaked into display payload: ${reveal.playerId}`);
    if (indexById.get(reveal.playerId)?.revealShard !== shardPath(reveal.playerId)) out.push(`Shard path mismatch: ${reveal.playerId}`);
    if (reveal.seasons.length !== card?.seasonRefs.length || reveal.seasons.length !== card?.career.seasonCount) out.push(`Runtime season count mismatch: ${reveal.playerId}`);
    if (!sameTeamIdentities(indexById.get(reveal.playerId)?.teamIdentities, reveal.career.teamIdentities)) out.push(`Runtime index team identities differ: ${reveal.playerId}`);
    for (const season of reveal.seasons) {
      const key = `${reveal.playerId}:${season.season}`;
      if (seenSeasonKeys.has(key)) out.push(`Duplicate runtime season: ${key}`);
      seenSeasonKeys.add(key);
      const enrichmentRow = seasonEnrichmentByKey.get(key);
      if (!enrichmentRow || enrichmentRow.lahmanPlayerId !== reveal.lahmanPlayerId) out.push(`Missing runtime season enrichment: ${key}`);
      if (season.teamIds.length !== season.teamIdentities.length) out.push(`Team display identity count mismatch: ${key}`);
      for (const identity of season.teamIdentities) {
        if (!season.teamIds.includes(identity.sourceTeamId)) out.push(`Team display source ID mismatch: ${key}:${identity.sourceTeamId}`);
      }
    }
  }

  const expectedSeasonKeys = new Set(seasonCards.map(seasonKey));
  if (seenSeasonKeys.size !== expectedSeasonKeys.size) out.push(`Runtime season-key count ${seenSeasonKeys.size} != canonical season-key count ${expectedSeasonKeys.size}`);
  for (const key of expectedSeasonKeys) if (!seenSeasonKeys.has(key)) out.push(`Runtime season missing: ${key}`);
  for (const playerId of Object.values(runtimeRedirects)) if (!revealById.has(playerId)) out.push(`Runtime redirect target missing: ${playerId}`);
  for (const entry of excludedRedirects) if (revealById.has(entry.playerId)) out.push(`Redirect excluded despite available reveal: ${entry.legacyPlayerId}`);
}

function regression({ reveals, playerIndex, issues: out }) {
  const byLahman = new Map(reveals.map(row => [row.lahmanPlayerId, row]));
  const indexByLahman = new Map(playerIndex.map(row => [row.lahmanPlayerId, row]));
  const tests = [
    ['ortizda01', 'David Ortiz', 'hitter', 2006, 'BOS'],
    ['riverma01', 'Mariano Rivera', 'pitcher', 1999, 'NYY'],
    ['ohtansh01', 'Shohei Ohtani', 'two-way', 2021, 'LAA'],
    ['griffke02', 'Ken Griffey Jr.', 'hitter', 1997, 'SEA'],
    ['wrighda03', 'David Wright', 'hitter', 2004, 'NYM'],
  ];
  for (const [lahmanId, displayName, playerType, season, abbreviation] of tests) {
    const reveal = byLahman.get(lahmanId);
    const index = indexByLahman.get(lahmanId);
    if (!reveal || !index) { out.push(`Runtime regression player missing: ${lahmanId}`); continue; }
    if (reveal.displayName !== displayName || index.displayName !== displayName) out.push(`Runtime regression name mismatch: ${lahmanId}`);
    if (reveal.playerType !== playerType || index.playerType !== playerType) out.push(`Runtime regression type mismatch: ${lahmanId}`);
    const seasonRow = reveal.seasons.find(row => row.season === season);
    if (!seasonRow) out.push(`Runtime regression season missing: ${lahmanId}:${season}`);
    else if (!seasonRow.teamIdentities.some(team => team.abbreviation === abbreviation)) out.push(`Runtime regression team display mismatch: ${lahmanId}:${season}:${abbreviation}`);
  }

  const historicalCases = [
    [1955, 'BRO', 'BRO'],
    [1962, 'LAN', 'LAD'],
    [1962, 'NYN', 'NYM'],
    [1962, 'NYA', 'NYY'],
  ];
  for (const [season, sourceTeamId, abbreviation] of historicalCases) {
    const identity = teamDisplayIndex.get(`${season}:${sourceTeamId}`);
    if (!identity || identity.abbreviation !== abbreviation) out.push(`Historical team display mismatch: ${season}:${sourceTeamId}:${abbreviation}`);
  }
}

function buildShards(records) {
  const shards = new Map();
  for (const record of records) {
    const shardId = shardIdFor(record.playerId);
    const rows = shards.get(shardId) ?? [];
    rows.push(record);
    shards.set(shardId, rows);
  }
  for (const rows of shards.values()) rows.sort((a, b) => a.playerId.localeCompare(b.playerId));
  return shards;
}

function shardIdFor(playerId) {
  const match = /^ibp_([0-9a-f]{2})[0-9a-f]{18}$/.exec(playerId);
  if (!match) throw new Error(`Invalid canonical player ID for sharding: ${playerId}`);
  return match[1];
}
function shardPath(playerId) { return `reveal-shards/${shardIdFor(playerId)}.json`; }
function seasonKey(row) { return `${row.playerId}:${row.season}`; }
function clone(value) { return value == null ? null : JSON.parse(JSON.stringify(value)); }
function readJson(path) { const text = readFileSync(path, 'utf8'); return { path, text, value: JSON.parse(text) }; }
function readText(path) { return { path, text: readFileSync(path, 'utf8') }; }
function manifestJson(input) { return { path: relativePath(input.path), schemaVersion: input.value.schemaVersion ?? null, sha256: sha256(input.text) }; }
function manifestText(input) { return { path: relativePath(input.path), sha256: sha256(input.text) }; }
function relativePath(path) { return path.replace(`${resolve(packageDir, '../..')}/`, '').replaceAll('\\', '/'); }
function jsonText(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function servingJsonText(value) { return `${JSON.stringify(value)}\n`; }
function writeJson(path, value) { writeFileSync(path, jsonText(value)); }
function writeServingJson(path, value) { writeFileSync(path, servingJsonText(value)); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function group(rows, fn) { const map = new Map(); for (const row of rows) { const key = fn(row); const list = map.get(key) ?? []; list.push(row); map.set(key, list); } return map; }
function uniqueIndex(rows, fn, label, out = null) { const map = new Map(); for (const row of rows) { const key = fn(row); if (!key) { if (out) out.push(`Missing ${label} key`); else throw new Error(`Missing ${label} key`); continue; } if (map.has(key)) { if (out) out.push(`Duplicate ${label}: ${key}`); else throw new Error(`Duplicate ${label}: ${key}`); } else map.set(key, row); } return map; }
function sameTeamIdentities(left, right) { return JSON.stringify(left ?? []) === JSON.stringify(right ?? []); }
function renderMarkdown(summary, warnings, issues) {
  return `# Canonical Runtime Payload Report\n\n- Universe players: ${summary.universePlayerCount}\n- Runtime players: ${summary.runtimePlayerCount}\n- Runtime season rows: ${summary.runtimeSeasonCount}\n- Source team IDs audited: ${summary.sourceTeamIdCount}\n- Fan-facing abbreviations: ${summary.displayAbbreviationCount}\n- Missing team display identities: ${summary.missingTeamDisplayIdentityCount}\n- Reveal shards: ${summary.shardCount}\n- Runtime redirects: ${summary.runtimeRedirectCount}\n- Excluded redirects: ${summary.excludedRedirectCount}\n- Warnings: ${summary.warningCount}\n- Critical issues: ${summary.criticalIssueCount}\n\n## Warnings\n\n${warnings.length ? warnings.map(item => `- ${item}`).join('\n') : '- None'}\n\n## Critical issues\n\n${issues.length ? issues.map(item => `- ${item}`).join('\n') : '- None'}\n`;
}
