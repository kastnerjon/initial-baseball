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
const BAT_FIELDS = ['games','atBats','runs','hits','doubles','triples','homeRuns','runsBattedIn','stolenBases','caughtStealing','walks','strikeouts','intentionalWalks','hitByPitch','sacrificeHits','sacrificeFlies','groundedIntoDoublePlay'];
const PITCH_FIELDS = ['wins','losses','games','gamesStarted','completeGames','shutouts','saves','outsPitched','hitsAllowed','earnedRuns','homeRunsAllowed','walksAllowed','strikeouts','opponentBattersFaced','intentionalWalks','wildPitches','hitBatters','balks','runsAllowed','sacrificeHitsAllowed','sacrificeFliesAllowed','groundedIntoDoublePlay'];
const APPEARANCE_FIELDS = ['gamesAll','gamesStarted','gamesBatting','gamesDefense','gamesPitcher','gamesCatcher','gamesFirstBase','gamesSecondBase','gamesThirdBase','gamesShortstop','gamesLeftField','gamesCenterField','gamesRightField','gamesOutfield','gamesDesignatedHitter','gamesPinchHitter','gamesPinchRunner'];

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

function aggregate(facts, fields) {
  const groups = new Map();
  for (const fact of facts) {
    const key = seasonKey(fact);
    const group = groups.get(key) ?? {
      playerId: fact.playerId,
      lahmanPlayerId: fact.lahmanPlayerId,
      season: fact.season,
      teamIds: new Set(),
      leagueIds: new Set(),
      stintCount: 0,
      values: Object.fromEntries(fields.map((field) => [field, { total: 0, present: 0 }])),
    };
    if (group.lahmanPlayerId !== fact.lahmanPlayerId) {
      throw new Error(`Conflicting Lahman IDs for ${key}: ${group.lahmanPlayerId} and ${fact.lahmanPlayerId}`);
    }
    if (fact.teamId) group.teamIds.add(fact.teamId);
    if (fact.leagueId) group.leagueIds.add(fact.leagueId);
    group.stintCount += 1;
    for (const field of fields) {
      const value = fact[field];
      if (value !== null && value !== undefined) {
        if (!Number.isInteger(value)) throw new Error(`Non-integer ${field} for ${key}`);
        group.values[field].total += value;
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
  const duplicateKeys = { batting: duplicates(batting), pitching: duplicates(pitching), appearances: duplicates(appearances) };
  for (const [kind, keys] of Object.entries(duplicateKeys)) {
    for (const key of keys) criticalIssues.push(`${kind} duplicate player-season: ${key}`);
  }
  const reconciliation = {
    batting: reconcileIndependently(batting, sources.batting.artifact.facts ?? [], BAT_FIELDS),
    pitching: reconcileIndependently(pitching, sources.pitching.artifact.facts ?? [], PITCH_FIELDS),
    appearances: reconcileIndependently(appearances, sources.appearances.artifact.facts ?? [], APPEARANCE_FIELDS),
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

function reconcileIndependently(aggregates, stints, fields) {
  const issues = [];
  const aggregateByKey = new Map(aggregates.map((fact) => [seasonKey(fact), fact]));
  const stintsByKey = new Map();
  for (const stint of stints) {
    const key = seasonKey(stint);
    const group = stintsByKey.get(key) ?? [];
    group.push(stint);
    stintsByKey.set(key, group);
  }
  if (aggregateByKey.size !== stintsByKey.size) issues.push(`row count ${aggregateByKey.size} != ${stintsByKey.size}`);
  for (const [key, group] of stintsByKey) {
    const actual = aggregateByKey.get(key);
    if (!actual) { issues.push(`missing ${key}`); continue; }
    const teamIds = [...new Set(group.map((fact) => fact.teamId).filter(Boolean))].sort();
    const leagueIds = [...new Set(group.map((fact) => fact.leagueId).filter(Boolean))].sort();
    if (actual.stintCount !== group.length) issues.push(`${key} stintCount ${actual.stintCount} != ${group.length}`);
    if (JSON.stringify(actual.teamIds) !== JSON.stringify(teamIds)) issues.push(`${key} teamIds differ`);
    if (JSON.stringify(actual.leagueIds) !== JSON.stringify(leagueIds)) issues.push(`${key} leagueIds differ`);
    if (group.some((fact) => fact.lahmanPlayerId !== actual.lahmanPlayerId)) issues.push(`${key} Lahman ID differs`);
    for (const field of fields) {
      const present = group.map((fact) => fact[field]).filter((value) => value !== null && value !== undefined);
      const expected = present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0);
      if (actual[field] !== expected) issues.push(`${key} ${field}: ${actual[field]} != ${expected}`);
    }
  }
  for (const key of aggregateByKey.keys()) {
    if (!stintsByKey.has(key)) issues.push(`unexpected ${key}`);
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
  return `# Canonical Player-Season Aggregates\n\nThis remains a shadow artifact; the live game is unchanged.\n\n## Summary\n\n- Batting seasons: ${report.summary.battingSeasonCount}\n- Pitching seasons: ${report.summary.pitchingSeasonCount}\n- Appearance seasons: ${report.summary.appearanceSeasonCount}\n- Two-way player-seasons: ${report.summary.twoWayPlayerSeasonCount}\n- Multi-team batting seasons: ${report.summary.multiTeamBattingSeasonCount}\n- Multi-team pitching seasons: ${report.summary.multiTeamPitchingSeasonCount}\n- Critical issues: ${report.summary.criticalIssueCount}\n\n## Contract\n\n- One row per canonical player and season.\n- Counting statistics sum across source stints.\n- A field remains null only when every contributing stint is null.\n- Team and league histories remain explicit sorted arrays.\n- Raw stint artifacts remain authoritative and auditable.\n- Reconciliation is independently recomputed from the raw stint rows.\n- Career aggregation and runtime migration remain deferred.\n`;
}
