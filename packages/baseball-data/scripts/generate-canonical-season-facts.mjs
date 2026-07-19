import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_OUTPUT_DIR = resolve(PACKAGE_DIR, 'reports/canonical-season-facts');

const PATHS = {
  universe: resolve(PACKAGE_DIR, 'reports/canonical-universe/canonical-player-universe.json'),
  batting: resolve(PACKAGE_DIR, 'data/lahman/Batting.csv'),
  pitching: resolve(PACKAGE_DIR, 'data/lahman/Pitching.csv'),
  appearances: resolve(PACKAGE_DIR, 'data/lahman/Appearances.csv'),
};

const args = process.argv.slice(2);
const outputDir = readArgumentValue('--output-dir') ?? DEFAULT_OUTPUT_DIR;
const strict = args.includes('--strict');

const inputs = Object.fromEntries(
  Object.entries(PATHS).map(([name, path]) => [name, readFileSync(path, 'utf8')]),
);

const universe = JSON.parse(inputs.universe);
const canonicalPlayers = universe.players ?? [];
const canonicalByLahmanId = buildCanonicalIndex(canonicalPlayers);

const batting = buildFacts(parseCsv(inputs.batting), canonicalByLahmanId, buildBattingFact);
const pitching = buildFacts(parseCsv(inputs.pitching), canonicalByLahmanId, buildPitchingFact);
const appearances = buildFacts(parseCsv(inputs.appearances), canonicalByLahmanId, buildAppearanceFact);

const validation = validate({ canonicalPlayers, batting, pitching, appearances });
const sourceManifest = {
  schemaVersion: 1,
  canonicalUniverse: sourceEntry(
    'packages/baseball-data/reports/canonical-universe/canonical-player-universe.json',
    inputs.universe,
  ),
  lahman: {
    batting: sourceEntry('packages/baseball-data/data/lahman/Batting.csv', inputs.batting),
    pitching: sourceEntry('packages/baseball-data/data/lahman/Pitching.csv', inputs.pitching),
    appearances: sourceEntry('packages/baseball-data/data/lahman/Appearances.csv', inputs.appearances),
  },
};

const shared = { schemaVersion: 1, sourceManifest };
mkdirSync(outputDir, { recursive: true });
writeJson(resolve(outputDir, 'batting-stints.json'), { ...shared, facts: batting.facts });
writeJson(resolve(outputDir, 'pitching-stints.json'), { ...shared, facts: pitching.facts });
writeJson(resolve(outputDir, 'appearances.json'), { ...shared, facts: appearances.facts });
writeJson(resolve(outputDir, 'canonical-season-facts-report.json'), {
  ...shared,
  summary: validation.summary,
  validation: validation.details,
});
writeFileSync(
  resolve(outputDir, 'canonical-season-facts-report.md'),
  renderMarkdown(validation),
);

console.log([
  `Built ${batting.facts.length} canonical batting stints,`,
  `${pitching.facts.length} pitching stints, and`,
  `${appearances.facts.length} appearance rows.`,
  `Critical issues: ${validation.summary.criticalIssueCount}.`,
  `Reports written to ${outputDir}.`,
].join(' '));

if (strict && validation.summary.criticalIssueCount > 0) {
  process.exitCode = 1;
}

function buildCanonicalIndex(players) {
  const index = new Map();
  for (const player of players) {
    const lahmanPlayerId = clean(player.lahmanPlayerId);
    const canonicalId = clean(player.canonicalId);
    if (!lahmanPlayerId || !canonicalId) continue;
    if (index.has(lahmanPlayerId)) {
      throw new Error(`Duplicate canonical mapping for Lahman player ${lahmanPlayerId}`);
    }
    index.set(lahmanPlayerId, canonicalId);
  }
  return index;
}

function buildFacts(rows, canonicalByLahmanId, mapper) {
  const facts = [];
  const unmatchedLahmanPlayerIds = new Set();

  for (const row of rows) {
    const lahmanPlayerId = clean(row.playerID);
    if (!lahmanPlayerId) continue;
    const canonicalId = canonicalByLahmanId.get(lahmanPlayerId);
    if (!canonicalId) {
      unmatchedLahmanPlayerIds.add(lahmanPlayerId);
      continue;
    }
    facts.push(mapper(row, canonicalId, lahmanPlayerId));
  }

  facts.sort(compareFacts);
  return {
    facts,
    unmatchedLahmanPlayerIds: [...unmatchedLahmanPlayerIds].sort(),
  };
}

function buildBattingFact(row, playerId, lahmanPlayerId) {
  return {
    playerId,
    lahmanPlayerId,
    season: integer(row.yearID),
    teamId: clean(row.teamID),
    leagueId: clean(row.lgID) || null,
    stint: integer(row.stint),
    games: nullableInteger(row.G),
    atBats: nullableInteger(row.AB),
    runs: nullableInteger(row.R),
    hits: nullableInteger(row.H),
    doubles: nullableInteger(row['2B']),
    triples: nullableInteger(row['3B']),
    homeRuns: nullableInteger(row.HR),
    runsBattedIn: nullableInteger(row.RBI),
    stolenBases: nullableInteger(row.SB),
    caughtStealing: nullableInteger(row.CS),
    walks: nullableInteger(row.BB),
    strikeouts: nullableInteger(row.SO),
    intentionalWalks: nullableInteger(row.IBB),
    hitByPitch: nullableInteger(row.HBP),
    sacrificeHits: nullableInteger(row.SH),
    sacrificeFlies: nullableInteger(row.SF),
    groundedIntoDoublePlay: nullableInteger(row.GIDP),
  };
}

function buildPitchingFact(row, playerId, lahmanPlayerId) {
  return {
    playerId,
    lahmanPlayerId,
    season: integer(row.yearID),
    teamId: clean(row.teamID),
    leagueId: clean(row.lgID) || null,
    stint: integer(row.stint),
    wins: nullableInteger(row.W),
    losses: nullableInteger(row.L),
    games: nullableInteger(row.G),
    gamesStarted: nullableInteger(row.GS),
    completeGames: nullableInteger(row.CG),
    shutouts: nullableInteger(row.SHO),
    saves: nullableInteger(row.SV),
    outsPitched: inningsToOuts(row.IPouts, row.IP),
    hitsAllowed: nullableInteger(row.H),
    earnedRuns: nullableInteger(row.ER),
    homeRunsAllowed: nullableInteger(row.HR),
    walksAllowed: nullableInteger(row.BB),
    strikeouts: nullableInteger(row.SO),
    opponentBattersFaced: nullableInteger(row.BFP),
    intentionalWalks: nullableInteger(row.IBB),
    wildPitches: nullableInteger(row.WP),
    hitBatters: nullableInteger(row.HBP),
    balks: nullableInteger(row.BK),
    runsAllowed: nullableInteger(row.R),
    sacrificeHitsAllowed: nullableInteger(row.SH),
    sacrificeFliesAllowed: nullableInteger(row.SF),
    groundedIntoDoublePlay: nullableInteger(row.GIDP),
  };
}

function buildAppearanceFact(row, playerId, lahmanPlayerId) {
  return {
    playerId,
    lahmanPlayerId,
    season: integer(row.yearID),
    teamId: clean(row.teamID),
    leagueId: clean(row.lgID) || null,
    gamesAll: nullableInteger(row.G_all),
    gamesStarted: nullableInteger(row.GS),
    gamesBatting: nullableInteger(row.G_batting),
    gamesDefense: nullableInteger(row.G_defense),
    gamesPitcher: nullableInteger(row.G_p),
    gamesCatcher: nullableInteger(row.G_c),
    gamesFirstBase: nullableInteger(row.G_1b),
    gamesSecondBase: nullableInteger(row.G_2b),
    gamesThirdBase: nullableInteger(row.G_3b),
    gamesShortstop: nullableInteger(row.G_ss),
    gamesLeftField: nullableInteger(row.G_lf),
    gamesCenterField: nullableInteger(row.G_cf),
    gamesRightField: nullableInteger(row.G_rf),
    gamesOutfield: nullableInteger(row.G_of),
    gamesDesignatedHitter: nullableInteger(row.G_dh),
    gamesPinchHitter: nullableInteger(row.G_ph),
    gamesPinchRunner: nullableInteger(row.G_pr),
  };
}

function validate({ canonicalPlayers, batting, pitching, appearances }) {
  const criticalIssues = [];
  const duplicateKeys = {
    batting: findDuplicateKeys(batting.facts, stintKey),
    pitching: findDuplicateKeys(pitching.facts, stintKey),
    appearances: findDuplicateKeys(appearances.facts, appearanceKey),
  };

  for (const [kind, keys] of Object.entries(duplicateKeys)) {
    for (const key of keys) criticalIssues.push(`${kind} duplicate key: ${key}`);
  }

  const malformed = [
    ...findMalformedFacts('batting', batting.facts),
    ...findMalformedFacts('pitching', pitching.facts),
    ...findMalformedFacts('appearances', appearances.facts),
  ];
  criticalIssues.push(...malformed);

  return {
    summary: {
      canonicalPlayerCount: canonicalPlayers.length,
      battingStintCount: batting.facts.length,
      pitchingStintCount: pitching.facts.length,
      appearanceRowCount: appearances.facts.length,
      playersWithBattingFacts: distinctPlayerCount(batting.facts),
      playersWithPitchingFacts: distinctPlayerCount(pitching.facts),
      playersWithAppearanceFacts: distinctPlayerCount(appearances.facts),
      unmatchedBattingLahmanPlayerCount: batting.unmatchedLahmanPlayerIds.length,
      unmatchedPitchingLahmanPlayerCount: pitching.unmatchedLahmanPlayerIds.length,
      unmatchedAppearanceLahmanPlayerCount: appearances.unmatchedLahmanPlayerIds.length,
      criticalIssueCount: criticalIssues.length,
    },
    details: {
      duplicateKeys,
      unmatchedLahmanPlayerIds: {
        batting: batting.unmatchedLahmanPlayerIds,
        pitching: pitching.unmatchedLahmanPlayerIds,
        appearances: appearances.unmatchedLahmanPlayerIds,
      },
      criticalIssues,
    },
  };
}

function findMalformedFacts(kind, facts) {
  const issues = [];
  for (const fact of facts) {
    if (!fact.playerId || !fact.lahmanPlayerId || !fact.season || !fact.teamId) {
      issues.push(`${kind} malformed fact: ${JSON.stringify(fact)}`);
    }
  }
  return issues;
}

function findDuplicateKeys(facts, keyBuilder) {
  const seen = new Set();
  const duplicates = new Set();
  for (const fact of facts) {
    const key = keyBuilder(fact);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates].sort();
}

function stintKey(fact) {
  return [fact.playerId, fact.season, fact.teamId, fact.stint].join('|');
}

function appearanceKey(fact) {
  return [fact.playerId, fact.season, fact.teamId].join('|');
}

function compareFacts(left, right) {
  return left.playerId.localeCompare(right.playerId)
    || left.season - right.season
    || left.teamId.localeCompare(right.teamId)
    || (left.stint ?? 0) - (right.stint ?? 0);
}

function distinctPlayerCount(facts) {
  return new Set(facts.map((fact) => fact.playerId)).size;
}

function inningsToOuts(ipOuts, innings) {
  const explicitOuts = nullableInteger(ipOuts);
  if (explicitOuts !== null) return explicitOuts;
  const value = clean(innings);
  if (!value) return null;
  const [whole, fraction = '0'] = value.split('.');
  const partialOuts = fraction === '1' ? 1 : fraction === '2' ? 2 : 0;
  return integer(whole) * 3 + partialOuts;
}

function sourceEntry(path, content) {
  return { path, sha256: sha256(content) };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function clean(value) {
  return String(value ?? '').trim();
}

function integer(value) {
  const parsed = Number.parseInt(clean(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableInteger(value) {
  const text = clean(value);
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readArgumentValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const [header = [], ...body] = rows;
  return body
    .filter((values) => values.some((value) => value !== ''))
    .map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}

function renderMarkdown(validation) {
  const { summary, details } = validation;
  const lines = [
    '# Canonical Lahman Season Facts',
    '',
    'This is a shadow artifact. The live game still consumes the existing serving files.',
    '',
    '## Summary',
    '',
    '| Check | Count |',
    '| --- | ---: |',
    `| Canonical players | ${summary.canonicalPlayerCount} |`,
    `| Batting stints | ${summary.battingStintCount} |`,
    `| Pitching stints | ${summary.pitchingStintCount} |`,
    `| Appearance rows | ${summary.appearanceRowCount} |`,
    `| Players with batting facts | ${summary.playersWithBattingFacts} |`,
    `| Players with pitching facts | ${summary.playersWithPitchingFacts} |`,
    `| Players with appearance facts | ${summary.playersWithAppearanceFacts} |`,
    `| Critical issues | ${summary.criticalIssueCount} |`,
    '',
    'Every published fact is joined through the canonical player’s exact Lahman player ID. No name or career-year matching occurs.',
    '',
    '## Validation',
    '',
  ];

  if (details.criticalIssues.length === 0) {
    lines.push('No critical issues.', '');
  } else {
    for (const issue of details.criticalIssues.slice(0, 100)) lines.push(`- ${issue}`);
    if (details.criticalIssues.length > 100) lines.push(`- …and ${details.criticalIssues.length - 100} more.`);
    lines.push('');
  }

  lines.push(
    '## Contract',
    '',
    '- Batting and pitching remain independent for two-way players.',
    '- Missing historical values remain null rather than becoming zero.',
    '- Pitching innings are stored as outs.',
    '- Stint rows remain at their natural Lahman grain.',
    '- Season and career totals are intentionally deferred to the next migration step.',
    '',
  );

  return `${lines.join('\n')}\n`;
}
