import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const PLAYERS_PATH = resolve(PACKAGE_DIR, 'src/generated/players.json');
const DEFAULT_REPORT_DIR = resolve(PACKAGE_DIR, 'reports');
const MAX_MARKDOWN_ROWS = 100;

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const outputDir = readArgumentValue('--output-dir') ?? DEFAULT_REPORT_DIR;
const playersJson = readFileSync(PLAYERS_PATH, 'utf8');
const players = JSON.parse(playersJson);

if (!Array.isArray(players)) {
  throw new Error('Expected generated players data to be an array.');
}

const report = buildAuditReport(players, playersJson);
mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'current-data-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(outputDir, 'current-data-audit.md'), renderMarkdown(report));

console.log(renderConsoleSummary(report));

if (strict && report.summary.criticalIssueCount > 0) {
  process.exitCode = 1;
}

function buildAuditReport(playerRows, rawJson) {
  const duplicateIds = findDuplicateGroups(playerRows, (player) => player.id);
  const duplicateDisplayNames = findDuplicateGroups(playerRows, (player) => normalizeName(player.displayName));
  const duplicateFullNames = findDuplicateGroups(playerRows, (player) => normalizeName(player.fullName));
  const invalidCareerRanges = playerRows
    .filter((player) => isNumber(player.firstYear) && isNumber(player.lastYear) && player.firstYear > player.lastYear)
    .map(summarizePlayer)
    .sort(comparePlayerSummaries);
  const eligiblePlayersMissingRequiredData = playerRows
    .filter((player) => player.dailyEligible && getMissingPlayableFields(player).length > 0)
    .map((player) => ({
      ...summarizePlayer(player),
      missingFields: getMissingPlayableFields(player),
    }))
    .sort(comparePlayerSummaries);
  const careerRoleMismatches = playerRows
    .filter(hasCareerRoleMismatch)
    .map((player) => ({
      ...summarizePlayer(player),
      careerStatsKind: player.careerStats?.kind ?? null,
    }))
    .sort(comparePlayerSummaries);
  const duplicateAliasesWithinPlayer = playerRows
    .map(findDuplicateAliasesWithinPlayer)
    .filter((entry) => entry.duplicateAliases.length > 0 || entry.aliasesMatchingCanonicalName.length > 0)
    .sort(comparePlayerSummaries);
  const aliasesMatchingOtherPlayers = findAliasesMatchingOtherPlayers(playerRows);
  const longDisplayNames = playerRows
    .filter((player) => tokenize(player.displayName).length >= 4)
    .map((player) => ({
      ...summarizePlayer(player),
      tokenCount: tokenize(player.displayName).length,
    }))
    .sort((left, right) => right.tokenCount - left.tokenCount || comparePlayerSummaries(left, right));
  const knownRegressionCases = buildKnownRegressionCases(playerRows);

  const criticalIssueCount = duplicateIds.length
    + invalidCareerRanges.length
    + eligiblePlayersMissingRequiredData.length
    + careerRoleMismatches.length;

  return {
    schemaVersion: 1,
    input: {
      path: 'packages/baseball-data/src/generated/players.json',
      sha256: createHash('sha256').update(rawJson).digest('hex'),
    },
    summary: {
      playerCount: playerRows.length,
      dailyEligibleCount: playerRows.filter((player) => player.dailyEligible).length,
      coreEligibleCount: playerRows.filter((player) => player.dailyEligibilityTier === 'core').length,
      extendedEligibleCount: playerRows.filter((player) => player.dailyEligibilityTier === 'extended').length,
      duplicateIdGroupCount: duplicateIds.length,
      duplicateDisplayNameGroupCount: duplicateDisplayNames.length,
      duplicateFullNameGroupCount: duplicateFullNames.length,
      invalidCareerRangeCount: invalidCareerRanges.length,
      eligibleMissingRequiredDataCount: eligiblePlayersMissingRequiredData.length,
      careerRoleMismatchCount: careerRoleMismatches.length,
      duplicateAliasPlayerCount: duplicateAliasesWithinPlayer.length,
      aliasMatchesOtherPlayerCount: aliasesMatchingOtherPlayers.length,
      longDisplayNameCount: longDisplayNames.length,
      criticalIssueCount,
    },
    findings: {
      duplicateIds,
      duplicateDisplayNames,
      duplicateFullNames,
      invalidCareerRanges,
      eligiblePlayersMissingRequiredData,
      careerRoleMismatches,
      duplicateAliasesWithinPlayer,
      aliasesMatchingOtherPlayers,
      longDisplayNames,
      knownRegressionCases,
    },
  };
}

function findDuplicateGroups(playerRows, getKey) {
  const groups = new Map();

  for (const player of playerRows) {
    const key = getKey(player);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(summarizePlayer(player));
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      players: group.sort(comparePlayerSummaries),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function getMissingPlayableFields(player) {
  const missing = [];

  if (!hasText(player.displayName)) missing.push('displayName');
  if (!hasText(player.fullName)) missing.push('fullName');
  if (!isNumber(player.firstYear)) missing.push('firstYear');
  if (!isNumber(player.lastYear)) missing.push('lastYear');
  if (!hasText(player.primaryPosition) || player.primaryPosition === 'Unknown') missing.push('primaryPosition');
  if (!hasText(player.teamsDisplay)) missing.push('teamsDisplay');
  if (!hasText(player.statsLine) || player.statsLine === 'Stats unavailable') missing.push('statsLine');
  if (player.careerStats === null || player.careerStats === undefined) missing.push('careerStats');

  return missing;
}

function hasCareerRoleMismatch(player) {
  const kind = player.careerStats?.kind;

  if (!kind || player.primaryRole === 'two_way') return false;
  return player.primaryRole !== kind;
}

function findDuplicateAliasesWithinPlayer(player) {
  const seen = new Set();
  const duplicateAliases = new Set();
  const aliasesMatchingCanonicalName = new Set();
  const canonicalNames = new Set([normalizeName(player.displayName), normalizeName(player.fullName)]);

  for (const alias of player.aliases ?? []) {
    const normalized = normalizeName(alias);
    if (!normalized) continue;

    if (seen.has(normalized)) duplicateAliases.add(alias);
    if (canonicalNames.has(normalized)) aliasesMatchingCanonicalName.add(alias);
    seen.add(normalized);
  }

  return {
    ...summarizePlayer(player),
    duplicateAliases: [...duplicateAliases].sort(),
    aliasesMatchingCanonicalName: [...aliasesMatchingCanonicalName].sort(),
  };
}

function findAliasesMatchingOtherPlayers(playerRows) {
  const playersByCanonicalName = new Map();

  for (const player of playerRows) {
    for (const name of [player.displayName, player.fullName]) {
      const normalized = normalizeName(name);
      if (!normalized) continue;
      const ids = playersByCanonicalName.get(normalized) ?? new Set();
      ids.add(player.id);
      playersByCanonicalName.set(normalized, ids);
    }
  }

  const findings = [];

  for (const player of playerRows) {
    for (const alias of player.aliases ?? []) {
      const normalizedAlias = normalizeName(alias);
      const matchedIds = [...(playersByCanonicalName.get(normalizedAlias) ?? [])]
        .filter((id) => id !== player.id)
        .sort();

      if (matchedIds.length > 0) {
        findings.push({
          ...summarizePlayer(player),
          alias,
          matchedPlayerIds: matchedIds,
        });
      }
    }
  }

  return findings.sort((left, right) => (
    normalizeName(left.alias).localeCompare(normalizeName(right.alias))
    || comparePlayerSummaries(left, right)
  ));
}

function buildKnownRegressionCases(playerRows) {
  const cases = [
    { label: 'David Ortiz', queries: ['david ortiz', 'david arias ortiz', 'david americo ortiz arias'] },
    { label: 'Emmanuel Clase', queries: ['emmanuel clase', 'emmanuel de la cruz clase'] },
    { label: 'Elly De La Cruz', queries: ['elly de la cruz'] },
    { label: 'Luis Arráez', queries: ['luis arraez', 'luis arráez'] },
    { label: 'Ken Griffey Jr.', queries: ['ken griffey jr', 'george kenneth griffey jr'] },
    { label: 'Hank Aaron', queries: ['hank aaron', 'henry louis aaron'] },
    { label: 'Mookie Betts', queries: ['mookie betts', 'markus lynn betts'] },
  ];

  return cases.map(({ label, queries }) => {
    const normalizedQueries = new Set(queries.map(normalizeName));
    const matches = playerRows
      .filter((player) => [player.displayName, player.fullName, ...(player.aliases ?? [])]
        .some((name) => normalizedQueries.has(normalizeName(name))))
      .map(summarizePlayer)
      .sort(comparePlayerSummaries);

    return { label, queries, matches };
  });
}

function summarizePlayer(player) {
  return {
    id: player.id,
    displayName: player.displayName,
    fullName: player.fullName,
    primaryRole: player.primaryRole,
    primaryPosition: player.primaryPosition,
    firstYear: player.firstYear,
    lastYear: player.lastYear,
    teamsDisplay: player.teamsDisplay,
    dailyEligibilityTier: player.dailyEligibilityTier,
    dailyEligible: player.dailyEligible,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Current Player Data Audit',
    '',
    `Input SHA-256: \`${report.input.sha256}\``,
    '',
    '## Summary',
    '',
    '| Check | Count |',
    '| --- | ---: |',
    `| Players | ${report.summary.playerCount} |`,
    `| Daily eligible | ${report.summary.dailyEligibleCount} |`,
    `| Core eligible | ${report.summary.coreEligibleCount} |`,
    `| Extended eligible | ${report.summary.extendedEligibleCount} |`,
    `| Duplicate ID groups | ${report.summary.duplicateIdGroupCount} |`,
    `| Duplicate display-name groups | ${report.summary.duplicateDisplayNameGroupCount} |`,
    `| Duplicate full-name groups | ${report.summary.duplicateFullNameGroupCount} |`,
    `| Invalid career ranges | ${report.summary.invalidCareerRangeCount} |`,
    `| Eligible players missing required data | ${report.summary.eligibleMissingRequiredDataCount} |`,
    `| Career role/stat-kind mismatches | ${report.summary.careerRoleMismatchCount} |`,
    `| Players with duplicate/canonical aliases | ${report.summary.duplicateAliasPlayerCount} |`,
    `| Aliases matching another player's canonical name | ${report.summary.aliasMatchesOtherPlayerCount} |`,
    `| Display names with four or more tokens | ${report.summary.longDisplayNameCount} |`,
    `| Critical issues | ${report.summary.criticalIssueCount} |`,
    '',
    'This report describes the current generated dataset. Duplicate names are review candidates, not automatic merge instructions.',
    '',
  ];

  appendDuplicateGroupSection(lines, 'Duplicate display names', report.findings.duplicateDisplayNames);
  appendDuplicateGroupSection(lines, 'Duplicate full names', report.findings.duplicateFullNames);
  appendPlayerSection(lines, 'Invalid career ranges', report.findings.invalidCareerRanges);
  appendPlayerSection(lines, 'Eligible players missing required data', report.findings.eligiblePlayersMissingRequiredData, (item) => item.missingFields.join(', '));
  appendPlayerSection(lines, 'Career role/stat-kind mismatches', report.findings.careerRoleMismatches, (item) => item.careerStatsKind ?? 'none');
  appendPlayerSection(lines, 'Long display names for review', report.findings.longDisplayNames, (item) => `${item.tokenCount} tokens`);

  lines.push('## Known regression cases', '');
  for (const regressionCase of report.findings.knownRegressionCases) {
    lines.push(`### ${regressionCase.label}`, '');
    if (regressionCase.matches.length === 0) {
      lines.push('No matching generated record found.', '');
      continue;
    }
    for (const player of regressionCase.matches) {
      lines.push(`- ${formatPlayer(player)}`);
    }
    lines.push('');
  }

  lines.push(
    '## Interpretation',
    '',
    '- Duplicate display or full names can represent either duplicate source identities or genuinely different people.',
    '- Long names are surfaced for review only; token count is not a safe display-name correction rule.',
    '- The next migration phase must add persistent canonical IDs and external-source mappings before merging identities.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function appendDuplicateGroupSection(lines, title, groups) {
  lines.push(`## ${title}`, '');

  if (groups.length === 0) {
    lines.push('None.', '');
    return;
  }

  for (const group of groups.slice(0, MAX_MARKDOWN_ROWS)) {
    lines.push(`### ${group.key}`, '');
    for (const player of group.players) lines.push(`- ${formatPlayer(player)}`);
    lines.push('');
  }

  appendTruncationNote(lines, groups.length);
}

function appendPlayerSection(lines, title, entries, describe = () => '') {
  lines.push(`## ${title}`, '');

  if (entries.length === 0) {
    lines.push('None.', '');
    return;
  }

  for (const entry of entries.slice(0, MAX_MARKDOWN_ROWS)) {
    const detail = describe(entry);
    lines.push(`- ${formatPlayer(entry)}${detail ? ` — ${detail}` : ''}`);
  }
  lines.push('');
  appendTruncationNote(lines, entries.length);
}

function appendTruncationNote(lines, totalCount) {
  if (totalCount > MAX_MARKDOWN_ROWS) {
    lines.push(`Markdown output shows the first ${MAX_MARKDOWN_ROWS} of ${totalCount}. See the JSON report for all rows.`, '');
  }
}

function formatPlayer(player) {
  const years = isNumber(player.firstYear) && isNumber(player.lastYear)
    ? `${player.firstYear}–${player.lastYear}`
    : 'years unknown';
  const role = [player.primaryRole, player.primaryPosition].filter(Boolean).join('/');
  return `**${player.displayName || '(missing display name)'}** — \`${player.id}\`; ${years}; ${role || 'role unknown'}; full name: ${player.fullName || '(missing)'}`;
}

function renderConsoleSummary(report) {
  return [
    `Audited ${report.summary.playerCount} generated players.`,
    `Duplicate display-name groups: ${report.summary.duplicateDisplayNameGroupCount}.`,
    `Eligible players missing required data: ${report.summary.eligibleMissingRequiredDataCount}.`,
    `Critical issues: ${report.summary.criticalIssueCount}.`,
    `Reports written to ${outputDir}.`,
  ].join(' ');
}

function readArgumentValue(name) {
  const argv = process.argv.slice(2);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function comparePlayerSummaries(left, right) {
  return normalizeName(left.displayName).localeCompare(normalizeName(right.displayName))
    || String(left.id).localeCompare(String(right.id));
}

function tokenize(value) {
  return hasText(value) ? value.trim().split(/\s+/).filter(Boolean) : [];
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
