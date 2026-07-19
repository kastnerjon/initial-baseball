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

const sources = {
  batting: readArtifact('batting-source-rows.json'),
  pitching: readArtifact('pitching-source-rows.json'),
  appearances: readArtifact('appearances.json'),
};
const appearanceFacts = sources.appearances.artifact.facts ?? [];
const appearances = aggregateAppearances(appearanceFacts);
const appearanceByKey = new Map(appearances.map((fact) => [seasonKey(fact), fact]));
const batting = aggregateSourceRows(
  sources.batting.artifact.facts ?? [],
  BATTING_FIELDS,
  appearanceByKey,
);
const pitching = aggregateSourceRows(
  sources.pitching.artifact.facts ?? [],
  PITCHING_FIELDS,
  appearanceByKey,
);
const validation = validate({
  batting,
  pitching,
  appearances,
  sources,
});
const sourceManifest = {
  schemaVersion: 1,
  batting: manifestEntry(
    'packages/baseball-data/reports/canonical-season-facts/batting-source-rows.json',
    sources.batting.text,
  ),
  pitching: manifestEntry(
    'packages/baseball-data/reports/canonical-season-facts/pitching-source-rows.json',
    sources.pitching.text,
  ),
  appearances: manifestEntry(
    'packages/baseball-data/reports/canonical-season-facts/appearances.json',
    sources.appearances.text,
  ),
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeJson('batting-seasons.json', {
  schemaVersion: 1,
  sourceManifest,
  facts: batting,
});
writeJson('pitching-seasons.json', {
  schemaVersion: 1,
  sourceManifest,
  facts: pitching,
});
writeJson('appearance-seasons.json', {
  schemaVersion: 1,
  sourceManifest,
  facts: appearances,
});
writeJson('canonical-season-aggregates-report.json', {
  schemaVersion: 1,
  sourceManifest,
  ...validation,
});
writeFileSync(
  resolve(OUTPUT_DIR, 'canonical-season-aggregates-report.md'),
  renderMarkdown(validation),
);

console.log([
  `Built ${batting.length} batting seasons,`,
  `${pitching.length} pitching seasons, and`,
  `${appearances.length} appearance seasons.`,
  `Critical issues: ${validation.summary.criticalIssueCount}.`,
  `Source warnings: ${validation.summary.warningCount}.`,
].join(' '));

if (strict && validation.summary.criticalIssueCount > 0) {
  process.exitCode = 1;
}

function aggregateSourceRows(facts, fields, appearanceByKey) {
  const groups = new Map();

  for (const fact of facts) {
    const key = seasonKey(fact);
    const group = groups.get(key) ?? {
      playerId: fact.playerId,
      lahmanPlayerId: fact.lahmanPlayerId,
      season: fact.season,
      sourceRowCount: 0,
      values: createAccumulators(fields),
    };
    assertSameLahmanPlayer(group, fact, key);
    group.sourceRowCount += 1;
    addValues(group.values, fact, fields, key);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const appearance = appearanceByKey.get(seasonKey(group));
      return {
        playerId: group.playerId,
        lahmanPlayerId: group.lahmanPlayerId,
        season: group.season,
        teamIds: appearance?.teamIds ?? [],
        sourceRowCount: group.sourceRowCount,
        ...finalizeValues(group.values, fields),
      };
    })
    .sort(compareSeason);
}

function aggregateAppearances(facts) {
  const groups = new Map();

  for (const fact of facts) {
    const key = seasonKey(fact);
    const group = groups.get(key) ?? {
      playerId: fact.playerId,
      lahmanPlayerId: fact.lahmanPlayerId,
      season: fact.season,
      teamIds: new Set(),
      appearanceRowCount: 0,
      values: createAccumulators(APPEARANCE_FIELDS),
    };
    assertSameLahmanPlayer(group, fact, key);
    if (fact.teamId) group.teamIds.add(fact.teamId);
    group.appearanceRowCount += 1;
    addValues(group.values, fact, APPEARANCE_FIELDS, key);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      playerId: group.playerId,
      lahmanPlayerId: group.lahmanPlayerId,
      season: group.season,
      teamIds: [...group.teamIds].sort(),
      appearanceRowCount: group.appearanceRowCount,
      ...finalizeValues(group.values, APPEARANCE_FIELDS),
    }))
    .sort(compareSeason);
}

function createAccumulators(fields) {
  return Object.fromEntries(
    fields.map((field) => [field, { total: 0, present: 0 }]),
  );
}

function addValues(accumulators, fact, fields, key) {
  for (const field of fields) {
    const value = fact[field];
    if (value === null || value === undefined) continue;
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid ${field} for ${key}: ${value}`);
    }
    accumulators[field].total += value;
    accumulators[field].present += 1;
  }
}

function finalizeValues(accumulators, fields) {
  return Object.fromEntries(fields.map((field) => [
    field,
    accumulators[field].present > 0 ? accumulators[field].total : null,
  ]));
}

function assertSameLahmanPlayer(group, fact, key) {
  if (group.lahmanPlayerId !== fact.lahmanPlayerId) {
    throw new Error([
      `Conflicting Lahman IDs for ${key}:`,
      group.lahmanPlayerId,
      'and',
      fact.lahmanPlayerId,
    ].join(' '));
  }
}

function validate({ batting, pitching, appearances, sources }) {
  const criticalIssues = [];
  const duplicateKeys = {
    batting: duplicates(batting),
    pitching: duplicates(pitching),
    appearances: duplicates(appearances),
  };
  for (const [kind, keys] of Object.entries(duplicateKeys)) {
    for (const key of keys) {
      criticalIssues.push(`${kind} duplicate player-season: ${key}`);
    }
  }

  const appearanceByKey = new Map(appearances.map((fact) => [seasonKey(fact), fact]));
  const reconciliation = {
    batting: reconcileSourceRows(
      batting,
      sources.batting.artifact.facts ?? [],
      BATTING_FIELDS,
      appearanceByKey,
    ),
    pitching: reconcileSourceRows(
      pitching,
      sources.pitching.artifact.facts ?? [],
      PITCHING_FIELDS,
      appearanceByKey,
    ),
    appearances: reconcileAppearances(
      appearances,
      sources.appearances.artifact.facts ?? [],
    ),
  };
  for (const [kind, issues] of Object.entries(reconciliation)) {
    for (const issue of issues) {
      criticalIssues.push(`${kind} reconciliation: ${issue}`);
    }
  }

  const missingAppearanceLinks = {
    batting: batting
      .filter((fact) => !appearanceByKey.has(seasonKey(fact)))
      .map(seasonKey),
    pitching: pitching
      .filter((fact) => !appearanceByKey.has(seasonKey(fact)))
      .map(seasonKey),
  };
  const warnings = [
    ...missingAppearanceLinks.batting.map(
      (key) => `batting source has no appearance season: ${key}`,
    ),
    ...missingAppearanceLinks.pitching.map(
      (key) => `pitching source has no appearance season: ${key}`,
    ),
  ];

  return {
    summary: {
      battingSeasonCount: batting.length,
      pitchingSeasonCount: pitching.length,
      appearanceSeasonCount: appearances.length,
      twoWayPlayerSeasonCount: intersectionCount(batting, pitching),
      multiTeamBattingSeasonCount: batting.filter((fact) => fact.teamIds.length > 1).length,
      multiTeamPitchingSeasonCount: pitching.filter((fact) => fact.teamIds.length > 1).length,
      battingSeasonWithoutAppearanceCount: missingAppearanceLinks.batting.length,
      pitchingSeasonWithoutAppearanceCount: missingAppearanceLinks.pitching.length,
      warningCount: warnings.length,
      criticalIssueCount: criticalIssues.length,
    },
    validation: {
      duplicateKeys,
      reconciliation,
      missingAppearanceLinks,
      warnings,
      criticalIssues,
    },
  };
}

function reconcileSourceRows(aggregates, sourceRows, fields, appearanceByKey) {
  const issues = [];
  const aggregateByKey = new Map(
    aggregates.map((fact) => [seasonKey(fact), fact]),
  );
  const rowsByKey = groupBySeason(sourceRows);

  if (aggregateByKey.size !== rowsByKey.size) {
    issues.push(`row count ${aggregateByKey.size} != ${rowsByKey.size}`);
  }

  for (const [key, rows] of rowsByKey) {
    const actual = aggregateByKey.get(key);
    if (!actual) {
      issues.push(`missing ${key}`);
      continue;
    }
    if (actual.sourceRowCount !== rows.length) {
      issues.push(`${key} sourceRowCount ${actual.sourceRowCount} != ${rows.length}`);
    }
    if (rows.some((row) => row.lahmanPlayerId !== actual.lahmanPlayerId)) {
      issues.push(`${key} Lahman ID differs`);
    }
    for (const field of fields) {
      const expected = sumKnown(rows, field);
      if (actual[field] !== expected) {
        issues.push(`${key} ${field}: ${actual[field]} != ${expected}`);
      }
    }
    const expectedTeams = appearanceByKey.get(key)?.teamIds ?? [];
    if (!sameArray(actual.teamIds, expectedTeams)) {
      issues.push(`${key} teamIds differ`);
    }
  }

  for (const key of aggregateByKey.keys()) {
    if (!rowsByKey.has(key)) issues.push(`unexpected ${key}`);
  }
  return issues;
}

function reconcileAppearances(aggregates, sourceRows) {
  const issues = [];
  const aggregateByKey = new Map(
    aggregates.map((fact) => [seasonKey(fact), fact]),
  );
  const rowsByKey = groupBySeason(sourceRows);

  if (aggregateByKey.size !== rowsByKey.size) {
    issues.push(`row count ${aggregateByKey.size} != ${rowsByKey.size}`);
  }

  for (const [key, rows] of rowsByKey) {
    const actual = aggregateByKey.get(key);
    if (!actual) {
      issues.push(`missing ${key}`);
      continue;
    }
    const expectedTeams = [...new Set(
      rows.map((row) => row.teamId).filter(Boolean),
    )].sort();
    if (actual.appearanceRowCount !== rows.length) {
      issues.push(`${key} appearanceRowCount ${actual.appearanceRowCount} != ${rows.length}`);
    }
    if (!sameArray(actual.teamIds, expectedTeams)) {
      issues.push(`${key} teamIds differ`);
    }
    if (rows.some((row) => row.lahmanPlayerId !== actual.lahmanPlayerId)) {
      issues.push(`${key} Lahman ID differs`);
    }
    for (const field of APPEARANCE_FIELDS) {
      const expected = sumKnown(rows, field);
      if (actual[field] !== expected) {
        issues.push(`${key} ${field}: ${actual[field]} != ${expected}`);
      }
    }
  }

  for (const key of aggregateByKey.keys()) {
    if (!rowsByKey.has(key)) issues.push(`unexpected ${key}`);
  }
  return issues;
}

function groupBySeason(facts) {
  const groups = new Map();
  for (const fact of facts) {
    const key = seasonKey(fact);
    const group = groups.get(key) ?? [];
    group.push(fact);
    groups.set(key, group);
  }
  return groups;
}

function sumKnown(rows, field) {
  const values = rows
    .map((row) => row[field])
    .filter((value) => value !== null && value !== undefined);
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0);
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
  return new Set(
    right.map(seasonKey).filter((key) => keys.has(key)),
  ).size;
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function seasonKey(fact) {
  return `${fact.playerId}|${fact.season}`;
}

function compareSeason(left, right) {
  return left.playerId.localeCompare(right.playerId)
    || left.season - right.season;
}

function manifestEntry(path, text) {
  return {
    path,
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

function readArtifact(name) {
  const text = readFileSync(resolve(INPUT_DIR, name), 'utf8');
  return { text, artifact: JSON.parse(text) };
}

function writeJson(name, value) {
  writeFileSync(
    resolve(OUTPUT_DIR, name),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function renderMarkdown(report) {
  const lines = [
    '# Canonical Player-Season Aggregates',
    '',
    'This remains a shadow artifact; the live game is unchanged.',
    '',
    '## Summary',
    '',
    `- Batting seasons: ${report.summary.battingSeasonCount}`,
    `- Pitching seasons: ${report.summary.pitchingSeasonCount}`,
    `- Appearance seasons: ${report.summary.appearanceSeasonCount}`,
    `- Two-way player-seasons: ${report.summary.twoWayPlayerSeasonCount}`,
    `- Multi-team batting seasons: ${report.summary.multiTeamBattingSeasonCount}`,
    `- Multi-team pitching seasons: ${report.summary.multiTeamPitchingSeasonCount}`,
    `- Batting seasons without appearances: ${report.summary.battingSeasonWithoutAppearanceCount}`,
    `- Pitching seasons without appearances: ${report.summary.pitchingSeasonWithoutAppearanceCount}`,
    `- Source warnings: ${report.summary.warningCount}`,
    `- Critical issues: ${report.summary.criticalIssueCount}`,
    '',
    '## Contract',
    '',
    '- One row per canonical player and season.',
    '- Batting and pitching counting statistics sum across the slim source rows.',
    '- A field remains null only when every contributing source row is null.',
    '- Team histories are joined from the team-grain appearances source when available.',
    '- A missing appearance row is preserved as an explicit source warning with an empty team list.',
    '- Position appearances are summed across team rows.',
    '- Reconciliation is independently recomputed from the source artifacts.',
    '- Career aggregation and runtime migration remain deferred.',
    '',
  ];

  if (report.validation.warnings.length > 0) {
    lines.push('## Source warnings', '');
    for (const warning of report.validation.warnings.slice(0, 100)) {
      lines.push(`- ${warning}`);
    }
    if (report.validation.warnings.length > 100) {
      lines.push(`- …and ${report.validation.warnings.length - 100} more.`);
    }
    lines.push('');
  }

  if (report.validation.criticalIssues.length > 0) {
    lines.push('## Critical issues', '');
    for (const issue of report.validation.criticalIssues.slice(0, 100)) {
      lines.push(`- ${issue}`);
    }
    if (report.validation.criticalIssues.length > 100) {
      lines.push(`- …and ${report.validation.criticalIssues.length - 100} more.`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
