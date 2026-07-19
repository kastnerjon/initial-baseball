import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeName } from './canonical-identity-core.mjs';

const PEOPLE_SHARDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = resolve(PACKAGE_DIR, 'reports/canonical-identities');
const CANONICAL_PLAYERS_PATH = resolve(OUTPUT_DIR, 'canonical-players.json');
const REPORT_PATH = resolve(OUTPUT_DIR, 'canonical-identity-report.json');
const CURRENT_PLAYERS_PATH = resolve(PACKAGE_DIR, 'src/generated/players.json');

const canonicalArtifact = JSON.parse(readFileSync(CANONICAL_PLAYERS_PATH, 'utf8'));
const identityReport = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
const currentPlayers = JSON.parse(readFileSync(CURRENT_PLAYERS_PATH, 'utf8'));
const chadwickCommit = canonicalArtifact.sourceManifest?.chadwick?.resolvedCommitSha;

if (!/^[a-f0-9]{40}$/i.test(chadwickCommit ?? '')) {
  throw new Error('Canonical identity artifact is missing a pinned Chadwick commit SHA.');
}

const reviewLegacyIds = new Set(identityReport.reviewQueue.flatMap((entry) => entry.legacyPlayerIds));
const reviewPersonIds = new Set([...reviewLegacyIds].map(extractChadwickPersonId).filter(Boolean));
const baseUrl = `https://raw.githubusercontent.com/chadwickbureau/register/${chadwickCommit}/data`;
const sourceRows = (await Promise.all(PEOPLE_SHARDS.map((shard) => fetchText(`${baseUrl}/people-${shard}.csv`))))
  .flatMap(parseCsv)
  .filter((row) => reviewPersonIds.has(row.key_person));
const sourceRowsByLegacyId = groupBy(sourceRows, (row) => `chadwick:${row.key_person}`);
const currentPlayerById = new Map(currentPlayers.map((player) => [player.id, player]));
const canonicalPlayerById = new Map(canonicalArtifact.players.map((player) => [player.canonicalId, player]));
const evidenceEntries = identityReport.reviewQueue.map((entry) => {
  const canonicalPlayer = canonicalPlayerById.get(entry.canonicalId);

  return {
    canonicalId: entry.canonicalId,
    displayName: entry.displayName,
    reason: entry.reason,
    weakLahmanCandidates: entry.weakLahmanCandidates,
    legacyRecords: entry.legacyPlayerIds.map((legacyPlayerId) => ({
      legacyPlayerId,
      currentGeneratedPlayer: summarizeCurrentPlayer(currentPlayerById.get(legacyPlayerId)),
      chadwickRows: (sourceRowsByLegacyId.get(legacyPlayerId) ?? []).map(summarizeChadwickRow),
    })),
    canonicalCandidate: canonicalPlayer ?? null,
  };
}).sort(compareEvidenceEntries);
const candidateGroupsByLahmanId = buildCandidateGroupsByLahmanId(evidenceEntries);
const exactRawFingerprintGroups = buildExactRawFingerprintGroups(evidenceEntries);
const knownRegressionCases = buildKnownRegressionCases(evidenceEntries, canonicalArtifact.players);
const evidence = {
  schemaVersion: 1,
  sourceManifest: canonicalArtifact.sourceManifest,
  summary: {
    reviewCandidateCount: evidenceEntries.length,
    reviewLegacyRecordCount: evidenceEntries.reduce((total, entry) => total + entry.legacyRecords.length, 0),
    sourceRowsFoundCount: sourceRows.length,
    weakLahmanCandidateGroupCount: candidateGroupsByLahmanId.length,
    exactRawFingerprintGroupCount: exactRawFingerprintGroups.length,
  },
  candidateGroupsByLahmanId,
  exactRawFingerprintGroups,
  knownRegressionCases,
  reviewCandidates: evidenceEntries,
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeJson(resolve(OUTPUT_DIR, 'identity-review-evidence.json'), evidence);
writeFileSync(resolve(OUTPUT_DIR, 'identity-review-evidence.md'), renderMarkdown(evidence));

console.log([
  `Generated evidence for ${evidence.summary.reviewCandidateCount} canonical review candidates.`,
  `Found ${evidence.summary.sourceRowsFoundCount} pinned Chadwick source rows.`,
  `Grouped ${evidence.summary.weakLahmanCandidateGroupCount} weak Lahman targets.`,
].join(' '));

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function buildCandidateGroupsByLahmanId(entries) {
  const groups = new Map();

  for (const entry of entries) {
    for (const candidate of entry.weakLahmanCandidates) {
      const group = groups.get(candidate.lahmanPlayerId) ?? {
        lahmanPlayerId: candidate.lahmanPlayerId,
        displayName: candidate.displayName,
        debutYear: candidate.debutYear,
        finalYear: candidate.finalYear,
        reviewCandidates: [],
      };
      group.reviewCandidates.push({
        canonicalId: entry.canonicalId,
        displayName: entry.displayName,
        legacyPlayerIds: entry.legacyRecords.map((record) => record.legacyPlayerId),
      });
      groups.set(candidate.lahmanPlayerId, group);
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      reviewCandidates: group.reviewCandidates.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId)),
    }))
    .sort((left, right) => right.reviewCandidates.length - left.reviewCandidates.length
      || left.displayName.localeCompare(right.displayName)
      || left.lahmanPlayerId.localeCompare(right.lahmanPlayerId));
}

function buildExactRawFingerprintGroups(entries) {
  const groups = new Map();

  for (const entry of entries) {
    for (const record of entry.legacyRecords) {
      for (const row of record.chadwickRows) {
        const fingerprint = buildRawIdentityFingerprint(row);
        if (!fingerprint) continue;
        const group = groups.get(fingerprint) ?? [];
        group.push({
          canonicalId: entry.canonicalId,
          displayName: entry.displayName,
          legacyPlayerId: record.legacyPlayerId,
          keyUuid: row.key_uuid,
        });
        groups.set(fingerprint, group);
      }
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([fingerprint, group]) => ({
      fingerprint,
      records: group.sort((left, right) => left.legacyPlayerId.localeCompare(right.legacyPlayerId)),
    }))
    .sort((left, right) => right.records.length - left.records.length || left.fingerprint.localeCompare(right.fingerprint));
}

function buildRawIdentityFingerprint(row) {
  const values = [
    normalizeName(row.name_first),
    normalizeName(row.name_given),
    normalizeName(row.name_last),
    normalizeName(row.name_matrilineal),
    normalizeName(row.name_suffix),
    row.birth_year,
    row.birth_month,
    row.birth_day,
    row.mlb_played_first,
    row.mlb_played_last,
    row.pro_played_first,
    row.pro_played_last,
  ].map((value) => String(value ?? '').trim());

  if (values.every((value) => !value)) {
    return '';
  }

  return values.join('|');
}

function buildKnownRegressionCases(reviewEntries, allCanonicalPlayers) {
  const labels = [
    'David Ortiz',
    'Mariano Rivera',
    'Ben Taylor',
    'Emmanuel Clase',
    'Elly De La Cruz',
    'Luis Arraez',
    'Ken Griffey',
  ];

  return labels.map((label) => ({
    label,
    canonicalPlayers: allCanonicalPlayers
      .filter((player) => normalizeName(player.displayName) === normalizeName(label)
        || player.aliases.some((alias) => normalizeName(alias) === normalizeName(label)))
      .map((player) => ({
        canonicalId: player.canonicalId,
        status: player.status,
        displayName: player.displayName,
        lahmanPlayerId: player.lahmanPlayerId,
        legacyPlayerIds: player.legacyPlayerIds,
      }))
      .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId)),
    reviewEvidence: reviewEntries
      .filter((entry) => normalizeName(entry.displayName) === normalizeName(label)
        || entry.canonicalCandidate?.aliases?.some((alias) => normalizeName(alias) === normalizeName(label)))
      .map((entry) => ({
        canonicalId: entry.canonicalId,
        reason: entry.reason,
        weakLahmanCandidates: entry.weakLahmanCandidates,
        legacyRecords: entry.legacyRecords,
      }))
      .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId)),
  }));
}

function summarizeCurrentPlayer(player) {
  if (!player) return null;

  return {
    id: player.id,
    displayName: player.displayName,
    fullName: player.fullName,
    aliases: player.aliases,
    firstYear: player.firstYear,
    lastYear: player.lastYear,
    primaryRole: player.primaryRole,
    primaryPosition: player.primaryPosition,
    teamsDisplay: player.teamsDisplay,
    dailyEligibilityTier: player.dailyEligibilityTier,
  };
}

function summarizeChadwickRow(row) {
  return {
    key_person: row.key_person,
    key_uuid: row.key_uuid,
    key_bbref: row.key_bbref,
    key_retro: row.key_retro,
    key_mlbam: row.key_mlbam,
    key_fangraphs: row.key_fangraphs,
    name_last: row.name_last,
    name_first: row.name_first,
    name_given: row.name_given,
    name_suffix: row.name_suffix,
    name_matrilineal: row.name_matrilineal,
    name_nick: row.name_nick,
    birth_year: row.birth_year,
    birth_month: row.birth_month,
    birth_day: row.birth_day,
    death_year: row.death_year,
    death_month: row.death_month,
    death_day: row.death_day,
    mlb_played_first: row.mlb_played_first,
    mlb_played_last: row.mlb_played_last,
    pro_played_first: row.pro_played_first,
    pro_played_last: row.pro_played_last,
    raw: sortObject(row),
  };
}

function renderMarkdown(evidence) {
  const lines = [
    '# Canonical Identity Review Evidence',
    '',
    `Pinned Chadwick commit: \`${evidence.sourceManifest.chadwick.resolvedCommitSha}\``,
    '',
    '## Summary',
    '',
    '| Check | Count |',
    '| --- | ---: |',
    `| Review candidates | ${evidence.summary.reviewCandidateCount} |`,
    `| Legacy records under review | ${evidence.summary.reviewLegacyRecordCount} |`,
    `| Chadwick source rows found | ${evidence.summary.sourceRowsFoundCount} |`,
    `| Weak Lahman target groups | ${evidence.summary.weakLahmanCandidateGroupCount} |`,
    `| Exact raw fingerprint groups | ${evidence.summary.exactRawFingerprintGroupCount} |`,
    '',
    'Exact raw fingerprints are evidence for review, not automatic merge instructions.',
    '',
    '## Largest weak Lahman candidate groups',
    '',
  ];

  for (const group of evidence.candidateGroupsByLahmanId.slice(0, 100)) {
    lines.push(`- **${group.displayName}** (\`${group.lahmanPlayerId}\`, ${group.debutYear ?? '?'}–${group.finalYear ?? '?'}) — ${group.reviewCandidates.length} review record(s): ${group.reviewCandidates.flatMap((entry) => entry.legacyPlayerIds).join(', ')}`);
  }
  lines.push('');

  lines.push('## Known regression cases', '');
  for (const regressionCase of evidence.knownRegressionCases) {
    lines.push(`### ${regressionCase.label}`, '');
    if (regressionCase.canonicalPlayers.length === 0) {
      lines.push('No matching canonical players.', '');
    } else {
      for (const player of regressionCase.canonicalPlayers) {
        lines.push(`- \`${player.canonicalId}\`; ${player.status}; ${player.displayName}; Lahman: ${player.lahmanPlayerId ?? 'none'}; legacy IDs: ${player.legacyPlayerIds.join(', ')}`);
      }
      lines.push('');
    }

    for (const entry of regressionCase.reviewEvidence) {
      lines.push(`Review \`${entry.canonicalId}\`:`);
      for (const record of entry.legacyRecords) {
        for (const row of record.chadwickRows) {
          lines.push(`- ${record.legacyPlayerId}: ${formatSourceEvidence(row)}`);
        }
      }
    }
    lines.push('');
  }

  lines.push('## Exact raw fingerprint groups', '');
  if (evidence.exactRawFingerprintGroups.length === 0) {
    lines.push('None.', '');
  } else {
    for (const group of evidence.exactRawFingerprintGroups.slice(0, 100)) {
      lines.push(`- ${group.records.length} records: ${group.records.map((record) => `${record.displayName} (${record.legacyPlayerId})`).join('; ')}`);
    }
    lines.push('');
  }

  lines.push(
    '## Review rule',
    '',
    'No record is merged from this evidence automatically. Reviewed decisions belong in `identity-decisions.json` with a reason, reviewer, and date.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function formatSourceEvidence(row) {
  const name = [row.name_first, row.name_given, row.name_matrilineal, row.name_last, row.name_suffix]
    .filter(Boolean)
    .join(' / ');
  const birth = [row.birth_year, row.birth_month, row.birth_day].filter(Boolean).join('-') || 'unknown birth date';
  const mlbYears = `${row.mlb_played_first || '?'}–${row.mlb_played_last || '?'}`;
  const ids = [
    row.key_bbref ? `bbref=${row.key_bbref}` : '',
    row.key_retro ? `retro=${row.key_retro}` : '',
    row.key_mlbam ? `mlbam=${row.key_mlbam}` : '',
    row.key_fangraphs ? `fangraphs=${row.key_fangraphs}` : '',
  ].filter(Boolean).join(', ') || 'no external IDs';
  return `${name || 'name missing'}; born ${birth}; MLB ${mlbYears}; ${ids}`;
}

function compareEvidenceEntries(left, right) {
  return left.reason.localeCompare(right.reason)
    || left.displayName.localeCompare(right.displayName)
    || left.canonicalId.localeCompare(right.canonicalId);
}

function groupBy(values, getKey) {
  const result = new Map();
  for (const value of values) {
    const key = getKey(value);
    const group = result.get(key) ?? [];
    group.push(value);
    result.set(key, group);
  }
  return result;
}

function extractChadwickPersonId(playerId) {
  return String(playerId ?? '').startsWith('chadwick:') ? playerId.slice('chadwick:'.length) : null;
}

function parseCsv(csv) {
  const normalized = csv.replace(/\r/g, '').trim();
  if (!normalized) return [];
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

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
  }
  return value;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
