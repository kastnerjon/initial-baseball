import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCanonicalIdentityLayer,
  normalizeName,
} from './canonical-identity-core.mjs';

const PEOPLE_SHARDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const PLAYERS_PATH = resolve(PACKAGE_DIR, 'src/generated/players.json');
const LAHMAN_PEOPLE_PATH = resolve(PACKAGE_DIR, 'data/lahman/People.csv');
const DECISIONS_PATH = resolve(PACKAGE_DIR, 'data/canonical/identity-decisions.json');
const DEFAULT_OUTPUT_DIR = resolve(PACKAGE_DIR, 'reports/canonical-identities');
const args = process.argv.slice(2);
const outputDir = readArgumentValue('--output-dir') ?? DEFAULT_OUTPUT_DIR;
const requestedChadwickRef = readArgumentValue('--chadwick-ref') ?? process.env.CHADWICK_REF ?? 'master';
const strict = args.includes('--strict');
const resolvedChadwickRef = await resolveChadwickRef(requestedChadwickRef);
const chadwickDataBaseUrl = `https://raw.githubusercontent.com/chadwickbureau/register/${resolvedChadwickRef}/data`;

const legacyPlayersJson = readFileSync(PLAYERS_PATH, 'utf8');
const lahmanPeopleCsv = readFileSync(LAHMAN_PEOPLE_PATH, 'utf8');
const decisionsJson = readFileSync(DECISIONS_PATH, 'utf8');
const legacyPlayers = JSON.parse(legacyPlayersJson);
const decisions = JSON.parse(decisionsJson);
const legacyPersonIds = new Set(legacyPlayers
  .map((player) => extractChadwickPersonId(player.id))
  .filter(Boolean));
const chadwickPeopleCsvs = await Promise.all(PEOPLE_SHARDS.map((shard) => fetchText(`${chadwickDataBaseUrl}/people-${shard}.csv`)));
const chadwickNameCsv = await fetchText(`${chadwickDataBaseUrl}/names.csv`);
const chadwickRows = chadwickPeopleCsvs
  .flatMap(parseCsv)
  .filter((row) => legacyPersonIds.has(row.key_person));
const aliasesByPersonId = buildAliasesByPersonId(parseCsv(chadwickNameCsv));
const lahmanPlayers = buildLahmanPlayers(parseCsv(lahmanPeopleCsv));
const result = buildCanonicalIdentityLayer({
  legacyPlayers,
  chadwickRows,
  aliasesByPersonId,
  lahmanPlayers,
  decisions,
});
const sourceManifest = {
  schemaVersion: 1,
  chadwick: {
    repository: 'chadwickbureau/register',
    requestedRef: requestedChadwickRef,
    resolvedCommitSha: resolvedChadwickRef,
    peopleShardCount: PEOPLE_SHARDS.length,
    peopleRowCount: chadwickRows.length,
    namesSha256: sha256(chadwickNameCsv),
    peopleShardsSha256: sha256(chadwickPeopleCsvs.join('\n')),
  },
  lahman: {
    repositoryPath: 'packages/baseball-data/data/lahman/People.csv',
    peopleRowCount: lahmanPlayers.length,
    peopleSha256: sha256(lahmanPeopleCsv),
  },
  currentGeneratedPlayers: {
    repositoryPath: 'packages/baseball-data/src/generated/players.json',
    playerCount: legacyPlayers.length,
    sha256: sha256(legacyPlayersJson),
  },
  identityDecisions: {
    repositoryPath: 'packages/baseball-data/data/canonical/identity-decisions.json',
    sha256: sha256(decisionsJson),
  },
};
const report = {
  schemaVersion: 1,
  sourceManifest,
  ...result.report,
  knownRegressionCases: buildKnownRegressionCases(result.canonicalPlayers),
};

mkdirSync(outputDir, { recursive: true });
writeJson(resolve(outputDir, 'canonical-players.json'), {
  schemaVersion: 1,
  sourceManifest,
  players: result.canonicalPlayers,
});
writeJson(resolve(outputDir, 'player-id-redirects.json'), {
  schemaVersion: 1,
  sourceManifest,
  redirects: result.redirects,
});
writeJson(resolve(outputDir, 'canonical-identity-report.json'), report);
writeFileSync(resolve(outputDir, 'canonical-identity-report.md'), renderMarkdown(report));

console.log([
  `Resolved Chadwick ${requestedChadwickRef} to ${resolvedChadwickRef}.`,
  `Mapped ${report.summary.legacyPlayerCount} legacy rows to ${report.summary.canonicalPlayerCount} canonical candidates.`,
  `Strong merges: ${report.summary.mergedLegacyGroupCount}.`,
  `Review candidates: ${report.summary.reviewCanonicalPlayerCount}.`,
  `Critical issues: ${report.summary.criticalIssueCount}.`,
  `Reports written to ${outputDir}.`,
].join(' '));

if (strict && report.summary.criticalIssueCount > 0) {
  process.exitCode = 1;
}

async function resolveChadwickRef(ref) {
  if (/^[a-f0-9]{40}$/i.test(ref)) {
    return ref.toLowerCase();
  }

  const response = await fetch(`https://api.github.com/repos/chadwickbureau/register/commits/${encodeURIComponent(ref)}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'initial-baseball-data-pipeline',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve Chadwick ref ${ref}: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();

  if (!body.sha || !/^[a-f0-9]{40}$/i.test(body.sha)) {
    throw new Error(`GitHub returned an invalid Chadwick commit SHA for ${ref}.`);
  }

  return body.sha.toLowerCase();
}

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function buildLahmanPlayers(rows) {
  return rows
    .filter((row) => row.playerID)
    .map((row) => ({
      playerId: row.playerID,
      bbrefId: row.bbrefID?.trim() || '',
      retroId: row.retroID?.trim() || '',
      displayName: formatName(row.nameFirst, row.nameLast),
      legalName: formatName(row.nameGiven, row.nameLast),
      debutYear: parseYear(row.debut),
      finalYear: parseYear(row.finalGame),
    }))
    .sort((left, right) => left.playerId.localeCompare(right.playerId));
}

function buildAliasesByPersonId(rows) {
  const aliasesByPersonId = new Map();

  for (const row of rows) {
    const personId = row.key_person?.trim();
    const alias = formatName(
      row.altname_given || row.altname_first,
      row.altname_matrilineal ? `${row.altname_matrilineal} ${row.altname_last}` : row.altname_last,
    );

    if (!personId) {
      continue;
    }

    const aliases = aliasesByPersonId.get(personId) ?? new Set();
    if (alias) aliases.add(alias);

    for (const nickname of splitNicknames(row.altname_nick)) {
      aliases.add(nickname);
    }

    aliasesByPersonId.set(personId, aliases);
  }

  return new Map([...aliasesByPersonId.entries()].map(([personId, aliases]) => [
    personId,
    [...aliases].sort((left, right) => normalizeName(left).localeCompare(normalizeName(right)) || left.localeCompare(right)),
  ]));
}

function buildKnownRegressionCases(players) {
  const cases = [
    { label: 'David Ortiz', queries: ['david ortiz', 'david arias ortiz', 'david americo ortiz arias'] },
    { label: 'Emmanuel Clase', queries: ['emmanuel clase', 'emmanuel de la cruz clase'] },
    { label: 'Elly De La Cruz', queries: ['elly de la cruz'] },
    { label: 'Luis Arráez', queries: ['luis arraez', 'luis arráez'] },
    { label: 'Ken Griffey Jr.', queries: ['ken griffey jr', 'george kenneth griffey jr'] },
    { label: 'Hank Aaron', queries: ['hank aaron', 'henry louis aaron'] },
    { label: 'Mookie Betts', queries: ['mookie betts', 'markus lynn betts'] },
    { label: 'Mariano Rivera', queries: ['mariano rivera'] },
    { label: 'Ben Taylor', queries: ['ben taylor'] },
  ];

  return cases.map(({ label, queries }) => {
    const normalizedQueries = new Set(queries.map(normalizeName));
    const matches = players
      .filter((player) => [player.displayName, ...player.aliases]
        .some((name) => normalizedQueries.has(normalizeName(name))))
      .map((player) => ({
        canonicalId: player.canonicalId,
        displayName: player.displayName,
        status: player.status,
        lahmanPlayerId: player.lahmanPlayerId,
        firstYear: player.firstYear,
        lastYear: player.lastYear,
        legacyPlayerIds: player.legacyPlayerIds,
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.canonicalId.localeCompare(right.canonicalId));

    return { label, queries, matches };
  });
}

function renderMarkdown(report) {
  const lines = [
    '# Canonical Identity Candidate Report',
    '',
    `Chadwick commit: \`${report.sourceManifest.chadwick.resolvedCommitSha}\``,
    '',
    '## Summary',
    '',
    '| Check | Count |',
    '| --- | ---: |',
    `| Legacy player rows | ${report.summary.legacyPlayerCount} |`,
    `| Canonical candidates | ${report.summary.canonicalPlayerCount} |`,
    `| Approved strong-ID candidates | ${report.summary.approvedCanonicalPlayerCount} |`,
    `| Review candidates | ${report.summary.reviewCanonicalPlayerCount} |`,
    `| Strongly merged legacy groups | ${report.summary.mergedLegacyGroupCount} |`,
    `| Legacy redirects generated | ${report.summary.redirectedLegacyPlayerCount} |`,
    `| Duplicate canonical display-name groups | ${report.summary.duplicateCanonicalDisplayNameGroupCount} |`,
    `| Weak name/year candidates | ${report.summary.weakCandidateCount} |`,
    `| Identity conflicts | ${report.summary.conflictCount} |`,
    `| Critical issues | ${report.summary.criticalIssueCount} |`,
    '',
    'Strong external IDs may merge source rows automatically. Name and career-year similarity only create review candidates.',
    '',
    '## Known regression cases',
    '',
  ];

  for (const regressionCase of report.knownRegressionCases) {
    lines.push(`### ${regressionCase.label}`, '');

    if (regressionCase.matches.length === 0) {
      lines.push('No canonical candidate matched the expected names or aliases.', '');
      continue;
    }

    for (const match of regressionCase.matches) {
      const years = match.firstYear && match.lastYear ? `${match.firstYear}–${match.lastYear}` : 'years unknown';
      lines.push(`- **${match.displayName}** — \`${match.canonicalId}\`; ${match.status}; Lahman: ${match.lahmanPlayerId ?? 'none'}; ${years}; legacy IDs: ${match.legacyPlayerIds.join(', ')}`);
    }
    lines.push('');
  }

  appendMergeGroups(lines, report.mergedLegacyGroups);
  appendDuplicateNames(lines, report.duplicateCanonicalDisplayNames);
  appendReviewQueue(lines, report.reviewQueue);
  appendCriticalIssues(lines, report.validation.criticalIssues);

  lines.push(
    '## Interpretation',
    '',
    '- A merged group means strong source identifiers connected multiple legacy rows to one identity component.',
    '- Duplicate canonical display names remain separate people until identity evidence proves otherwise.',
    '- Review candidates are not eligible for automatic production migration yet.',
    '- The generated redirect file is a candidate migration artifact and is not consumed by the live game in this phase.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function appendMergeGroups(lines, groups) {
  lines.push('## Strongly merged legacy groups', '');

  if (groups.length === 0) {
    lines.push('None.', '');
    return;
  }

  for (const group of groups.slice(0, 150)) {
    lines.push(`- **${group.displayName}** — \`${group.canonicalId}\`; Lahman: ${group.lahmanPlayerId ?? 'none'}; legacy IDs: ${group.legacyPlayerIds.join(', ')}`);
  }
  lines.push('');
  appendTruncation(lines, groups.length, 150);
}

function appendDuplicateNames(lines, groups) {
  lines.push('## Canonical same-name groups', '');

  if (groups.length === 0) {
    lines.push('None.', '');
    return;
  }

  for (const group of groups.slice(0, 100)) {
    lines.push(`### ${group.normalizedDisplayName}`, '');
    for (const player of group.players) {
      lines.push(`- \`${player.canonicalId}\`; ${player.status}; Lahman: ${player.lahmanPlayerId ?? 'none'}; ${player.firstYear ?? '?'}–${player.lastYear ?? '?'}; legacy IDs: ${player.legacyPlayerIds.join(', ')}`);
    }
    lines.push('');
  }
  appendTruncation(lines, groups.length, 100);
}

function appendReviewQueue(lines, entries) {
  lines.push('## Review queue', '');

  if (entries.length === 0) {
    lines.push('None.', '');
    return;
  }

  for (const entry of entries.slice(0, 150)) {
    const candidates = entry.weakLahmanCandidates.map((candidate) => `${candidate.displayName} (${candidate.lahmanPlayerId})`).join(', ');
    lines.push(`- **${entry.displayName}** — \`${entry.canonicalId}\`; ${entry.reason}; legacy IDs: ${entry.legacyPlayerIds.join(', ')}${candidates ? `; candidates: ${candidates}` : ''}`);
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
    lines.push(`Markdown output shows the first ${limit} of ${count}. See JSON for the complete set.`, '');
  }
}

function parseCsv(csv) {
  const normalized = csv.replace(/\r/g, '').trim();

  if (!normalized) {
    return [];
  }

  const [headerLine, ...lines] = normalized.split('\n');
  const headers = parseCsvLine(headerLine);

  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
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
  return [first, last].map((value) => String(value ?? '').trim()).filter(Boolean).join(' ');
}

function splitNicknames(value) {
  return String(value ?? '')
    .split(/[|;]/)
    .map((nickname) => nickname.trim())
    .filter(Boolean);
}

function parseYear(value) {
  const year = Number.parseInt(String(value ?? '').slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

function extractChadwickPersonId(playerId) {
  return String(playerId ?? '').startsWith('chadwick:') ? playerId.slice('chadwick:'.length) : null;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readArgumentValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
