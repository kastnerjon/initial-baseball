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
const BATTING_FIELDS = [
  'atBats', 'runs', 'hits', 'doubles', 'triples', 'homeRuns',
  'runsBattedIn', 'stolenBases', 'walks', 'hitByPitch', 'sacrificeFlies',
];
const PITCHING_FIELDS = [
  'wins', 'losses', 'saves', 'outsPitched', 'hitsAllowed',
  'earnedRuns', 'walksAllowed', 'strikeouts',
];
const APPEARANCE_FIELDS = [
  'gamesAll', 'gamesPitcher', 'gamesCatcher', 'gamesFirstBase',
  'gamesSecondBase', 'gamesThirdBase', 'gamesShortstop', 'gamesLeftField',
  'gamesCenterField', 'gamesRightField', 'gamesDesignatedHitter',
];

const args = process.argv.slice(2);
const outputDir = readArgumentValue('--output-dir') ?? DEFAULT_OUTPUT_DIR;
const strict = args.includes('--strict');
const inputs = Object.fromEntries(
  Object.entries(PATHS).map(([name, path]) => [name, readFileSync(path, 'utf8')]),
);
const universe = JSON.parse(inputs.universe);
const canonicalPlayers = universe.players ?? [];
const canonicalByLahmanId = buildCanonicalIndex(canonicalPlayers);
const batting = buildSourceRows(
  parseCsv(inputs.batting),
  canonicalByLahmanId,
  buildBattingFact,
);
const pitching = buildSourceRows(
  parseCsv(inputs.pitching),
  canonicalByLahmanId,
  buildPitchingFact,
);
const appearances = buildAppearanceFacts(
  parseCsv(inputs.appearances),
  canonicalByLahmanId,
);
const validation = validate({
  canonicalPlayers,
  batting,
  pitching,
  appearances,
});
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
writeJson(resolve(outputDir, 'batting-source-rows.json'), {
  ...shared,
  facts: batting.facts,
});
writeJson(resolve(outputDir, 'pitching-source-rows.json'), {
  ...shared,
  facts: pitching.facts,
});
writeJson(resolve(outputDir, 'appearances.json'), {
  ...shared,
  facts: appearances.facts,
});
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
  `Built ${batting.facts.length} canonical batting source rows,`,
  `${pitching.facts.length} pitching source rows, and`,
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

function buildSourceRows(rows, canonicalByLahmanId, mapper) {
  const facts = [];
  const unmatchedLahmanPlayerIds = new Set();
  const nextSourceRowByPlayerSeason = new Map();

  for (const row of rows) {
    const lahmanPlayerId = clean(row.playerID);
    if (!lahmanPlayerId) continue;
    const playerId = canonicalByLahmanId.get(lahmanPlayerId);
    if (!playerId) {
      unmatchedLahmanPlayerIds.add(lahmanPlayerId);
      continue;
    }
    const season = integer(row.yearID);
    const key = `${playerId}|${season}`;
    const sourceRow = (nextSourceRowByPlayerSeason.get(key) ?? 0) + 1;
    nextSourceRowByPlayerSeason.set(key, sourceRow);
    facts.push(mapper(row, playerId, lahmanPlayerId, season, sourceRow));
  }

  facts.sort(compareSourceFacts);
  return {
    facts,
    unmatchedLahmanPlayerIds: [...unmatchedLahmanPlayerIds].sort(),
  };
}

function buildAppearanceFacts(rows, canonicalByLahmanId) {
  const facts = [];
  const unmatchedLahmanPlayerIds = new Set();

  for (const row of rows) {
    const lahmanPlayerId = clean(row.playerID);
    if (!lahmanPlayerId) continue;
    const playerId = canonicalByLahmanId.get(lahmanPlayerId);
    if (!playerId) {
      unmatchedLahmanPlayerIds.add(lahmanPlayerId);
      continue;
    }
    facts.push({
      playerId,
      lahmanPlayerId,
      season: integer(row.yearID),
      teamId: clean(row.teamID),
      gamesPitcher: nullableInteger(row.G_p),
      gamesCatcher: nullableInteger(row.G_c),
      gamesFirstBase: nullableInteger(row.G_1b),
      gamesSecondBase: nullableInteger(row.G_2b),
      gamesThirdBase: nullableInteger(row.G_3b),
      gamesShortstop: nullableInteger(row.G_ss),
      gamesLeftField: nullableInteger(row.G_lf),
      gamesCenterField: nullableInteger(row.G_cf),
      gamesRightField: nullableInteger(row.G_rf),
      gamesDesignatedHitter: nullableInteger(row.G_dh),
      gamesAll: nullableInteger(row.G_all),
    });
  }

  facts.sort(compareAppearanceFacts);
  return {
    facts,
    unmatchedLahmanPlayerIds: [...unmatchedLahmanPlayerIds].sort(),
  };
}

function buildBattingFact(row, playerId, lahmanPlayerId, season, sourceRow) {
  return {
    playerId,
    lahmanPlayerId,
    season,
    sourceRow,
    atBats: nullableInteger(row.AB),
    runs: nullableInteger(row.R),
    hits: nullableInteger(row.H),
    doubles: nullableInteger(row['2B']),
    triples: nullableInteger(row['3B']),
    homeRuns: nullableInteger(row.HR),
    runsBattedIn: nullableInteger(row.RBI),
    stolenBases: nullableInteger(row.SB),
    walks: nullableInteger(row.BB),
    hitByPitch: nullableInteger(row.HBP),
    sacrificeFlies: nullableInteger(row.SF),
  };
}

function buildPitchingFact(row, playerId, lahmanPlayerId, season, sourceRow) {
  return {
    playerId,
    lahmanPlayerId,
    season,
    sourceRow,
    wins: nullableInteger(row.W),
    losses: nullableInteger(row.L),
    saves: nullableInteger(row.SV),
    outsPitched: nullableInteger(row.IPouts),
    hitsAllowed: nullableInteger(row.H),
    earnedRuns: nullableInteger(row.ER),
    walksAllowed: nullableInteger(row.BB),
    strikeouts: nullableInteger(row.SO),
  };
}

function validate({ canonicalPlayers, batting, pitching, appearances }) {
  const criticalIssues = [];
  const duplicateKeys = {
    batting: findDuplicateKeys(batting.facts, sourceRowKey),
    pitching: findDuplicateKeys(pitching.facts, sourceRowKey),
    appearances: findDuplicateKeys(appearances.facts, appearanceKey),
  };
  for (const [kind, keys] of Object.entries(duplicateKeys)) {
    for (const key of keys) criticalIssues.push(`${kind} duplicate key: ${key}`);
  }

  appendIssues(criticalIssues, findMalformedSourceRows('batting', batting.facts));
  appendIssues(criticalIssues, findMalformedSourceRows('pitching', pitching.facts));
  appendIssues(criticalIssues, findMalformedAppearances(appearances.facts));
  appendIssues(criticalIssues, findInvalidIntegers('batting', batting.facts, BATTING_FIELDS));
  appendIssues(criticalIssues, findInvalidIntegers('pitching', pitching.facts, PITCHING_FIELDS));
  appendIssues(criticalIssues, findInvalidIntegers('appearances', appearances.facts, APPEARANCE_FIELDS));

  return {
    summary: {
      canonicalPlayerCount: canonicalPlayers.length,
      battingSourceRowCount: batting.facts.length,
      pitchingSourceRowCount: pitching.facts.length,
      appearanceRowCount: appearances.facts.length,
      battingPlayerSeasonCount: distinctSeasonCount(batting.facts),
      pitchingPlayerSeasonCount: distinctSeasonCount(pitching.facts),
      appearancePlayerSeasonCount: distinctSeasonCount(appearances.facts),
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

function findMalformedSourceRows(kind, facts) {
  return facts
    .filter((fact) => !fact.playerId || !fact.lahmanPlayerId || fact.season <= 0 || fact.sourceRow <= 0)
    .map((fact) => `${kind} malformed source row: ${JSON.stringify(fact)}`);
}

function findMalformedAppearances(facts) {
  return facts
    .filter((fact) => !fact.playerId || !fact.lahmanPlayerId || fact.season <= 0 || !fact.teamId)
    .map((fact) => `appearances malformed row: ${JSON.stringify(fact)}`);
}

function findInvalidIntegers(kind, facts, fields) {
  const issues = [];
  for (const fact of facts) {
    for (const field of fields) {
      const value = fact[field];
      if (value !== null && (!Number.isInteger(value) || value < 0)) {
        issues.push(`${kind} invalid ${field} for ${sourceRowKey(fact)}: ${value}`);
      }
    }
  }
  return issues;
}

function appendIssues(target, issues) {
  for (const issue of issues) target.push(issue);
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

function sourceRowKey(fact) {
  return [fact.playerId, fact.season, fact.sourceRow].join('|');
}

function appearanceKey(fact) {
  return [fact.playerId, fact.season, fact.teamId].join('|');
}

function seasonKey(fact) {
  return [fact.playerId, fact.season].join('|');
}

function compareSourceFacts(left, right) {
  return left.playerId.localeCompare(right.playerId)
    || left.season - right.season
    || left.sourceRow - right.sourceRow;
}

function compareAppearanceFacts(left, right) {
  return left.playerId.localeCompare(right.playerId)
    || left.season - right.season
    || left.teamId.localeCompare(right.teamId);
}

function distinctPlayerCount(facts) {
  return new Set(facts.map((fact) => fact.playerId)).size;
}

function distinctSeasonCount(facts) {
  return new Set(facts.map(seasonKey)).size;
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
    .map((values) => Object.fromEntries(
      header.map((key, index) => [key, values[index] ?? '']),
    ));
}

function renderMarkdown(validation) {
  const { summary, details } = validation;
  const lines = [
    '# Canonical Lahman Source Facts',
    '',
    'This is a shadow artifact. The live game still consumes the existing serving files.',
    '',
    '## Summary',
    '',
    '| Check | Count |',
    '| --- | ---: |',
    `| Canonical players | ${summary.canonicalPlayerCount} |`,
    `| Batting source rows | ${summary.battingSourceRowCount} |`,
    `| Pitching source rows | ${summary.pitchingSourceRowCount} |`,
    `| Appearance rows | ${summary.appearanceRowCount} |`,
    `| Batting player-seasons | ${summary.battingPlayerSeasonCount} |`,
    `| Pitching player-seasons | ${summary.pitchingPlayerSeasonCount} |`,
    `| Appearance player-seasons | ${summary.appearancePlayerSeasonCount} |`,
    `| Critical issues | ${summary.criticalIssueCount} |`,
    '',
    'Every published row is joined through the canonical player’s exact Lahman player ID. No name or career-year matching occurs.',
    '',
    '## Validation',
    '',
  ];

  if (details.criticalIssues.length === 0) {
    lines.push('No critical issues.', '');
  } else {
    for (const issue of details.criticalIssues.slice(0, 100)) lines.push(`- ${issue}`);
    if (details.criticalIssues.length > 100) {
      lines.push(`- …and ${details.criticalIssues.length - 100} more.`);
    }
    lines.push('');
  }

  lines.push(
    '## Source contract',
    '',
    '- The repository batting and pitching files are slim source tables, not full Lahman stint tables.',
    '- Their rows retain only the counting-stat columns present in those files.',
    '- Repeated player-year rows are preserved with a deterministic source-row ordinal and summed in the season layer.',
    '- Team and position history comes from the separate team-grain appearances file.',
    '- Missing historical values remain null rather than becoming zero.',
    '- Pitching workload is stored as outs.',
    '- Career aggregation and runtime migration remain deferred.',
    '',
  );

  return `${lines.join('\n')}\n`;
}
