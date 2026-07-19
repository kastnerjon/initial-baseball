import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCanonicalPlayerUniverse } from './canonical-universe-core.mjs';
import { normalizeName } from './canonical-identity-core.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const ROOT_DIR = resolve(PACKAGE_DIR, '../..');
const LAHMAN_PEOPLE_PATH = resolve(PACKAGE_DIR, 'data/lahman/People.csv');
const LAHMAN_HALL_OF_FAME_PATH = resolve(PACKAGE_DIR, 'data/lahman/HallOfFame.csv');
const CANONICAL_IDENTITIES_PATH = resolve(PACKAGE_DIR, 'reports/canonical-identities/canonical-players.json');
const DISPOSITIONS_PATH = resolve(PACKAGE_DIR, 'reports/canonical-identities/identity-disposition-recommendations.json');
const COMPATIBILITY_REDIRECTS_PATH = resolve(PACKAGE_DIR, 'data/canonical/compatibility-redirects.json');
const DAILY_OVERRIDES_PATH = resolve(ROOT_DIR, 'apps/web/app/dailyPuzzleOverrides.ts');
const DEFAULT_OUTPUT_DIR = resolve(PACKAGE_DIR, 'reports/canonical-universe');
const args = process.argv.slice(2);
const outputDir = readArgumentValue('--output-dir') ?? DEFAULT_OUTPUT_DIR;
const strict = args.includes('--strict');

const lahmanPeopleCsv = readFileSync(LAHMAN_PEOPLE_PATH, 'utf8');
const lahmanHallOfFameCsv = readFileSync(LAHMAN_HALL_OF_FAME_PATH, 'utf8');
const canonicalIdentitiesJson = readFileSync(CANONICAL_IDENTITIES_PATH, 'utf8');
const dispositionsJson = readFileSync(DISPOSITIONS_PATH, 'utf8');
const compatibilityRedirectsJson = readFileSync(COMPATIBILITY_REDIRECTS_PATH, 'utf8');
const dailyOverridesText = readFileSync(DAILY_OVERRIDES_PATH, 'utf8');

const lahmanPlayers = buildLahmanPlayers(parseCsv(lahmanPeopleCsv));
const inductedHallOfFamePlayerIds = buildInductedHallOfFamePlayerIds(parseCsv(lahmanHallOfFameCsv));
const canonicalIdentityArtifact = JSON.parse(canonicalIdentitiesJson);
const dispositionArtifact = JSON.parse(dispositionsJson);
const compatibilityRedirectArtifact = JSON.parse(compatibilityRedirectsJson);
const historicalReferenceIds = extractPlayerIds(dailyOverridesText);

const result = buildCanonicalPlayerUniverse({
  lahmanPlayers,
  inductedHallOfFamePlayerIds,
  canonicalIdentityPlayers: canonicalIdentityArtifact.players ?? [],
  dispositionRecommendations: dispositionArtifact.recommendations ?? [],
  compatibilityRedirects: compatibilityRedirectArtifact.redirects ?? [],
  historicalReferenceIds,
});

const sourceManifest = {
  schemaVersion: 1,
  lahman: {
    peoplePath: 'packages/baseball-data/data/lahman/People.csv',
    peopleSha256: sha256(lahmanPeopleCsv),
    hallOfFamePath: 'packages/baseball-data/data/lahman/HallOfFame.csv',
    hallOfFameSha256: sha256(lahmanHallOfFameCsv),
    personCount: lahmanPlayers.length,
    inductedPlayerCount: inductedHallOfFamePlayerIds.size,
  },
  canonicalIdentities: {
    path: 'packages/baseball-data/reports/canonical-identities/canonical-players.json',
    sha256: sha256(canonicalIdentitiesJson),
    sourceManifest: canonicalIdentityArtifact.sourceManifest ?? null,
  },
  dispositionRecommendations: {
    path: 'packages/baseball-data/reports/canonical-identities/identity-disposition-recommendations.json',
    sha256: sha256(dispositionsJson),
  },
  compatibilityRedirects: {
    path: 'packages/baseball-data/data/canonical/compatibility-redirects.json',
    sha256: sha256(compatibilityRedirectsJson),
  },
  historicalReferences: {
    path: 'apps/web/app/dailyPuzzleOverrides.ts',
    sha256: sha256(dailyOverridesText),
    referenceCount: historicalReferenceIds.length,
  },
};

const report = {
  schemaVersion: 1,
  sourceManifest,
  ...result.report,
  knownRegressionCases: buildKnownRegressionCases(result.universePlayers),
};

mkdirSync(outputDir, { recursive: true });
writeJson(resolve(outputDir, 'canonical-player-universe.json'), {
  schemaVersion: 1,
  sourceManifest,
  players: result.universePlayers,
});
writeJson(resolve(outputDir, 'canonical-player-redirects.json'), {
  schemaVersion: 1,
  sourceManifest,
  redirects: result.redirects,
  identityRedirects: result.identityRedirects,
});
writeJson(resolve(outputDir, 'retired-legacy-player-ids.json'), {
  schemaVersion: 1,
  sourceManifest,
  retiredLegacyIds: result.retiredLegacyIds,
});
writeJson(resolve(outputDir, 'canonical-universe-report.json'), report);
writeFileSync(resolve(outputDir, 'canonical-universe-report.md'), renderMarkdown(report));

console.log([
  `Built ${report.summary.eligibleCanonicalPlayerCount} Lahman-first canonical players.`,
  `Strong legacy identities: ${report.summary.playersWithStrongLegacyIdentityCount}.`,
  `Compatibility redirects: ${report.summary.compatibilityRedirectCount}.`,
  `Retired legacy IDs: ${report.summary.retiredLegacyIdCount}.`,
  `Unresolved historical references: ${report.summary.unresolvedHistoricalReferenceCount}.`,
  `Critical issues: ${report.summary.criticalIssueCount}.`,
  `Reports written to ${outputDir}.`,
].join(' '));

if (strict && report.summary.criticalIssueCount > 0) {
  process.exitCode = 1;
}

function buildLahmanPlayers(rows) {
  return rows
    .filter((row) => row.playerID)
    .map((row) => ({
      playerId: row.playerID.trim(),
      bbrefId: row.bbrefID?.trim() || '',
      retroId: row.retroID?.trim() || '',
      displayName: formatName(row.nameFirst, row.nameLast),
      legalName: formatName(row.nameGiven, row.nameLast),
      debutYear: parseYear(row.debut),
      finalYear: parseYear(row.finalGame),
    }))
    .sort((left, right) => left.playerId.localeCompare(right.playerId));
}

function buildInductedHallOfFamePlayerIds(rows) {
  return new Set(rows
    .filter((row) => row.inducted === 'Y' && normalizeName(row.category) === 'player' && row.playerID)
    .map((row) => row.playerID.trim()));
}

function extractPlayerIds(source) {
  const result = new Set();
  const pattern = /playerId\s*:\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    result.add(match[1]);
  }

  return [...result].sort();
}

function buildKnownRegressionCases(players) {
  const cases = [
    { label: 'David Ortiz', queries: ['david ortiz', 'david arias ortiz', 'david americo ortiz'] },
    { label: 'Emmanuel Clase', queries: ['emmanuel clase', 'emmanuel de la cruz clase'] },
    { label: 'Elly De La Cruz', queries: ['elly de la cruz'] },
    { label: 'Luis Arráez', queries: ['luis arraez', 'luis arráez'] },
    { label: 'Ken Griffey Jr.', queries: ['ken griffey jr', 'george kenneth griffey jr'] },
    { label: 'Hank Aaron', queries: ['hank aaron', 'henry louis aaron'] },
    { label: 'Mookie Betts', queries: ['mookie betts', 'markus lynn betts'] },
    { label: 'Mariano Rivera', queries: ['mariano rivera'] },
    { label: 'Ben Taylor', queries: ['ben taylor', 'benjamin taylor'] },
  ];

  return cases.map(({ label, queries }) => {
    const normalizedQueries = new Set(queries.map(normalizeName));
    const matches = players
      .filter((player) => [player.displayName, player.legalName, ...player.aliases]
        .some((name) => normalizedQueries.has(normalizeName(name))))
      .map((player) => ({
        canonicalId: player.canonicalId,
        lahmanPlayerId: player.lahmanPlayerId,
        displayName: player.displayName,
        aliases: player.aliases,
        firstYear: player.firstYear,
        lastYear: player.lastYear,
        legacyPlayerIds: player.legacyPlayerIds,
      }))
      .sort((left, right) => normalizeName(left.displayName).localeCompare(normalizeName(right.displayName))
        || String(left.firstYear ?? '').localeCompare(String(right.firstYear ?? ''))
        || left.lahmanPlayerId.localeCompare(right.lahmanPlayerId));

    return { label, queries, matches };
  });
}

function renderMarkdown(report) {
  const lines = [
    '# Lahman-First Canonical Player Universe',
    '',
    'This is a shadow publication artifact. The live game still consumes the legacy player dataset.',
    '',
    '## Summary',
    '',
    '| Check | Count |',
    '| --- | ---: |',
    `| Lahman people | ${report.summary.lahmanPlayerCount} |`,
    `| Eligible canonical players | ${report.summary.eligibleCanonicalPlayerCount} |`,
    `| Players with strong legacy identity | ${report.summary.playersWithStrongLegacyIdentityCount} |`,
    `| Players without a current legacy identity | ${report.summary.playersWithoutLegacyIdentityCount} |`,
    `| Strong identity redirects | ${report.summary.identityRedirectCount} |`,
    `| Compatibility redirects | ${report.summary.compatibilityRedirectCount} |`,
    `| Retired unsupported legacy IDs | ${report.summary.retiredLegacyIdCount} |`,
    `| Unpublished review candidates | ${report.summary.reviewCandidateCount} |`,
    `| Genuine same-name groups | ${report.summary.duplicateDisplayNameGroupCount} |`,
    `| Historical player references | ${report.summary.historicalReferenceCount} |`,
    `| Unresolved historical references | ${report.summary.unresolvedHistoricalReferenceCount} |`,
    `| Critical issues | ${report.summary.criticalIssueCount} |`,
    '',
    'One Lahman player produces one canonical player. Unsupported Chadwick-only rows do not create search or gameplay records.',
    '',
    '## Historical reference audit',
    '',
  ];

  if (report.historicalReferenceAudit.length === 0) {
    lines.push('No historical player-ID references found.', '');
  } else {
    for (const reference of report.historicalReferenceAudit) {
      lines.push(`- \`${reference.legacyPlayerId}\` → ${reference.canonicalId ? `\`${reference.canonicalId}\`` : '**UNRESOLVED**'}`);
    }
    lines.push('');
  }

  lines.push('## Compatibility redirects', '');
  if (report.appliedCompatibilityRedirects.length === 0) {
    lines.push('None.', '');
  } else {
    for (const redirect of report.appliedCompatibilityRedirects) {
      lines.push(`- \`${redirect.legacyPlayerId}\` → **${redirect.displayName}** / ${redirect.targetLahmanPlayerId}; ${redirect.scope}; ${redirect.reason}`);
    }
    lines.push('');
  }

  lines.push('## Known regression cases', '');
  for (const regressionCase of report.knownRegressionCases) {
    lines.push(`### ${regressionCase.label}`, '');
    if (regressionCase.matches.length === 0) {
      lines.push('No canonical universe match.', '');
      continue;
    }
    for (const match of regressionCase.matches) {
      const years = match.firstYear && match.lastYear ? `${match.firstYear}–${match.lastYear}` : 'years unknown';
      lines.push(`- **${match.displayName}** — \`${match.canonicalId}\`; Lahman: ${match.lahmanPlayerId}; ${years}; legacy IDs: ${match.legacyPlayerIds.join(', ') || 'none'}`);
    }
    lines.push('');
  }

  appendSameNameGroups(lines, report.duplicateDisplayNameGroups);
  appendRetiredLegacyIds(lines, report.retiredLegacyIds);
  appendCriticalIssues(lines, report.validation.criticalIssues);

  lines.push(
    '## Interpretation',
    '',
    '- Same visible names remain separate when Lahman identifies different people.',
    '- Identity redirects claim source-backed person equivalence.',
    '- Compatibility redirects preserve explicit historical app intent without claiming the old source row was the same human.',
    '- Retired IDs receive no target and will disappear from the future search universe.',
    '- Search, hints, reveals, Daily selection, and saved-state migration are not switched in this phase.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function appendSameNameGroups(lines, groups) {
  lines.push('## Canonical same-name groups', '');
  if (groups.length === 0) {
    lines.push('None.', '');
    return;
  }

  for (const group of groups.slice(0, 100)) {
    lines.push(`### ${group.normalizedDisplayName}`, '');
    for (const player of group.players) {
      lines.push(`- \`${player.canonicalId}\`; Lahman: ${player.lahmanPlayerId}; ${player.firstYear ?? '?'}–${player.lastYear ?? '?'}`);
    }
    lines.push('');
  }
  appendTruncation(lines, groups.length, 100);
}

function appendRetiredLegacyIds(lines, entries) {
  lines.push('## Retired legacy IDs', '');
  if (entries.length === 0) {
    lines.push('None.', '');
    return;
  }

  for (const entry of entries.slice(0, 150)) {
    lines.push(`- \`${entry.legacyPlayerId}\` — **${entry.displayName}**; ${entry.disposition}; ${entry.reason}`);
  }
  lines.push('');
  appendTruncation(lines, entries.length, 150);
}

function appendCriticalIssues(lines, entries) {
  lines.push('## Critical issues', '');
  if (entries.length === 0) {
    lines.push('None.', '');
    return;
  }

  for (const entry of entries.slice(0, 150)) {
    lines.push(`- \`${entry.type}\`: ${JSON.stringify(entry)}`);
  }
  lines.push('');
  appendTruncation(lines, entries.length, 150);
}

function appendTruncation(lines, count, limit) {
  if (count > limit) {
    lines.push(`Showing the first ${limit} of ${count}. See JSON for the complete list.`, '');
  }
}

function parseCsv(csv) {
  const rows = [];
  const normalized = csv.replace(/\r/g, '').trim();
  if (!normalized) return rows;
  const [headerLine, ...lines] = normalized.split('\n');
  const headers = parseCsvLine(headerLine);

  for (const line of lines) {
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = {};
    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = values[index] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += character;
  }

  values.push(current);
  return values;
}

function formatName(first, last) {
  return [first, last].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
}

function parseYear(value) {
  const match = String(value ?? '').match(/^(\d{4})/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readArgumentValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
