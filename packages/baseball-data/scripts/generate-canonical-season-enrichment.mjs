import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seasonCardPath = resolve(packageDir, 'reports/canonical-season-cards/season-cards.json');
const outputDir = resolve(packageDir, 'reports/canonical-season-enrichment');
const strict = process.argv.includes('--strict');

const input = readJson(seasonCardPath);
const cards = input.value.cards ?? [];
const issues = [];

const enrichments = cards
  .map(card => buildEnrichment(card))
  .sort((a, b) => a.playerId.localeCompare(b.playerId) || a.season - b.season);

validate(enrichments, issues);
regression(enrichments, issues);

const sourceManifest = {
  seasonCards: manifestJson(input),
  unavailableSources: {
    war: 'No committed, licensed WAR source is present.',
    opsPlus: 'No committed league-adjusted batting source is present.',
    eraPlus: 'No committed league-adjusted pitching source is present.',
    fip: 'No approved FIP derivation contract is present.',
    awards: 'No committed player-awards table is present.',
    allStarSelections: 'No committed All-Star table is present.',
    leagueLeaders: 'Not yet derived from canonical league-season comparisons.',
  },
};

const summary = {
  seasonCardCount: cards.length,
  enrichmentCount: enrichments.length,
  opsCount: enrichments.filter(row => row.advanced.ops != null).length,
  criticalIssueCount: issues.length,
};

mkdirSync(outputDir, { recursive: true });
writeJson(resolve(outputDir, 'season-enrichment.json'), { schemaVersion: 1, sourceManifest, enrichments });
writeJson(resolve(outputDir, 'canonical-season-enrichment-report.json'), { schemaVersion: 1, sourceManifest, summary, criticalIssues: issues });
writeFileSync(resolve(outputDir, 'canonical-season-enrichment-report.md'), renderMarkdown(summary, issues));
console.log(`Built ${enrichments.length} canonical season enrichments. OPS: ${summary.opsCount}. Critical issues: ${issues.length}.`);
if (strict && issues.length) process.exitCode = 1;

function buildEnrichment(card) {
  const batting = card.batting ?? null;
  const onBasePercentage = batting ? deriveOnBasePercentage(batting) : null;
  const sluggingPercentage = batting?.sluggingPercentage ?? null;
  const ops = onBasePercentage != null && sluggingPercentage != null
    ? onBasePercentage + sluggingPercentage
    : null;

  return {
    schemaVersion: 1,
    playerId: card.playerId,
    lahmanPlayerId: card.lahmanPlayerId,
    season: card.season,
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
      awards: null,
      allStarSelection: null,
      leagueLeaderFlags: null,
      awardVotingFinishes: null,
    },
    provenance: {
      ops: ops == null ? null : 'derived_from_canonical_lahman_season_totals',
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

function validate(rows, out) {
  const cardsByKey = uniqueIndex(cards, seasonKey, 'season card');
  const rowsByKey = uniqueIndex(rows, seasonKey, 'season enrichment', out);
  if (rows.length !== cards.length) out.push(`Enrichment count ${rows.length} != season card count ${cards.length}`);
  for (const card of cards) if (!rowsByKey.has(seasonKey(card))) out.push(`Missing enrichment: ${seasonKey(card)}`);
  for (const row of rows) {
    const key = seasonKey(row);
    const card = cardsByKey.get(key);
    if (!card || card.lahmanPlayerId !== row.lahmanPlayerId) out.push(`Identity mismatch: ${key}`);
    if (!Number.isInteger(row.season)) out.push(`Invalid season: ${key}`);
    if (row.advanced.ops != null) {
      if (row.advanced.onBasePercentage == null || row.advanced.sluggingPercentage == null) out.push(`OPS missing component: ${key}`);
      if (Math.abs(row.advanced.ops - (row.advanced.onBasePercentage + row.advanced.sluggingPercentage)) > 1e-12) out.push(`OPS reconciliation failed: ${key}`);
    }
    if (row.advanced.war !== null || row.advanced.opsPlus !== null || row.advanced.eraPlus !== null || row.advanced.fip !== null) out.push(`Unsupported advanced value populated: ${key}`);
    if (row.achievements.awards !== null || row.achievements.allStarSelection !== null || row.achievements.leagueLeaderFlags !== null || row.achievements.awardVotingFinishes !== null) out.push(`Unsupported achievement populated: ${key}`);
  }
}

function regression(rows, out) {
  const byKey = new Map(rows.map(row => [`${row.lahmanPlayerId}:${row.season}`, row]));
  const tests = [
    ['ortizda01', 2006],
    ['griffke02', 1997],
    ['ohtansh01', 2021],
  ];
  for (const [lahmanId, season] of tests) {
    const row = byKey.get(`${lahmanId}:${season}`);
    if (!row) out.push(`Regression enrichment missing: ${lahmanId}:${season}`);
    else if (row.advanced.ops == null) out.push(`Regression OPS missing: ${lahmanId}:${season}`);
  }
}

function readJson(path) { const text = readFileSync(path, 'utf8'); return { path, text, value: JSON.parse(text) }; }
function manifestJson(input) { return { path: relativePath(input.path), schemaVersion: input.value.schemaVersion ?? null, sha256: sha256(input.text) }; }
function relativePath(path) { return path.replace(`${resolve(packageDir, '../..')}/`, ''); }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function allKnown(values) { return values.every(value => value !== null && value !== undefined && Number.isFinite(value)); }
function seasonKey(row) { return `${row.playerId}:${row.season}`; }
function uniqueIndex(rows, fn, label, out = null) { const map = new Map(); for (const row of rows) { const key = fn(row); if (!key) { if (out) out.push(`Missing ${label} key`); else throw new Error(`Missing ${label} key`); continue; } if (map.has(key)) { if (out) out.push(`Duplicate ${label}: ${key}`); else throw new Error(`Duplicate ${label}: ${key}`); } else map.set(key, row); } return map; }
function renderMarkdown(summary, issues) { return `# Canonical Season Enrichment Report\n\n- Season cards: ${summary.seasonCardCount}\n- Enrichments: ${summary.enrichmentCount}\n- Seasons with OPS: ${summary.opsCount}\n- Critical issues: ${summary.criticalIssueCount}\n\n${issues.length ? issues.map(issue => `- ${issue}`).join('\n') : 'No critical issues.'}\n`; }
