import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeName } from './canonical-identity-core.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = resolve(PACKAGE_DIR, 'reports/canonical-identities');
const EVIDENCE_PATH = resolve(OUTPUT_DIR, 'identity-review-evidence.json');
const evidence = JSON.parse(readFileSync(EVIDENCE_PATH, 'utf8'));
const recommendations = evidence.reviewCandidates
  .map(recommendDisposition)
  .sort((left, right) => left.recommendedDisposition.localeCompare(right.recommendedDisposition)
    || left.displayName.localeCompare(right.displayName)
    || left.canonicalId.localeCompare(right.canonicalId));
const counts = countBy(recommendations, (entry) => entry.recommendedDisposition);
const report = {
  schemaVersion: 1,
  sourceManifest: evidence.sourceManifest,
  summary: {
    reviewCandidateCount: recommendations.length,
    reviewMlbIdentityCount: counts.review_mlb_identity ?? 0,
    reviewExternalIdentityCount: counts.review_external_identity ?? 0,
    excludeUnverifiedNonMlbCount: counts.exclude_unverified_non_mlb ?? 0,
    manualConflictCount: counts.manual_conflict ?? 0,
  },
  knownRegressionCases: buildKnownRegressionCases(recommendations),
  recommendations,
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeJson(resolve(OUTPUT_DIR, 'identity-disposition-recommendations.json'), report);
writeFileSync(resolve(OUTPUT_DIR, 'identity-disposition-recommendations.md'), renderMarkdown(report));

console.log([
  `Classified ${report.summary.reviewCandidateCount} identity candidates.`,
  `MLB identity review: ${report.summary.reviewMlbIdentityCount}.`,
  `External identity review: ${report.summary.reviewExternalIdentityCount}.`,
  `Recommended exclusion: ${report.summary.excludeUnverifiedNonMlbCount}.`,
  `Manual conflicts: ${report.summary.manualConflictCount}.`,
].join(' '));

function recommendDisposition(entry) {
  const rows = entry.legacyRecords.flatMap((record) => record.chadwickRows);
  const hasRawMlbCareer = rows.some((row) => hasValue(row.mlb_played_first) || hasValue(row.mlb_played_last));
  const hasBbrefOrRetroIdentity = rows.some((row) => hasValue(row.key_bbref) || hasValue(row.key_retro));
  const hasOnlySecondaryExternalIdentity = !hasBbrefOrRetroIdentity
    && rows.some((row) => hasValue(row.key_mlbam) || hasValue(row.key_fangraphs));
  const hasRawProCareer = rows.some((row) => hasValue(row.pro_played_first) || hasValue(row.pro_played_last));
  const birthDates = [...new Set(rows.map(formatBirthDate).filter(Boolean))].sort();
  const rawMlbRanges = [...new Set(rows.map(formatMlbRange).filter(Boolean))].sort();
  const rawProRanges = [...new Set(rows.map(formatProRange).filter(Boolean))].sort();
  let recommendedDisposition;
  let reason;

  if (entry.reason === 'conflicting_strong_identity_links') {
    recommendedDisposition = 'manual_conflict';
    reason = 'Strong source identifiers connect the record to conflicting identities.';
  } else if (hasRawMlbCareer) {
    recommendedDisposition = 'review_mlb_identity';
    reason = 'The Chadwick source row contains an MLB playing range, so it may represent a legitimate separate MLB identity or a merge candidate.';
  } else if (hasBbrefOrRetroIdentity) {
    recommendedDisposition = 'review_external_identity';
    reason = 'The row has Baseball-Reference or Retrosheet identity evidence but no Chadwick MLB playing range; it must not be merged by name.';
  } else {
    recommendedDisposition = 'exclude_unverified_non_mlb';
    reason = hasOnlySecondaryExternalIdentity
      ? 'The row has only secondary IDs and no Chadwick MLB playing range; an MLBAM or FanGraphs ID alone does not prove MLB eligibility.'
      : hasRawProCareer
        ? 'The row has a professional career but no Chadwick MLB playing range, so it should not enter the MLB player universe without review.'
        : 'The row has no Chadwick MLB career evidence and entered the current universe only through weak same-name matching.';
  }

  return {
    canonicalId: entry.canonicalId,
    displayName: entry.displayName,
    currentReason: entry.reason,
    recommendedDisposition,
    reason,
    weakLahmanCandidates: entry.weakLahmanCandidates,
    legacyPlayerIds: entry.legacyRecords.map((record) => record.legacyPlayerId).sort(),
    evidenceSummary: {
      hasRawMlbCareer,
      hasBbrefOrRetroIdentity,
      hasOnlySecondaryExternalIdentity,
      hasRawProCareer,
      birthDates,
      rawMlbRanges,
      rawProRanges,
      externalIds: collectExternalIds(rows),
    },
  };
}

function collectExternalIds(rows) {
  const values = [];

  for (const row of rows) {
    for (const [source, value] of [
      ['bbref', row.key_bbref],
      ['retro', row.key_retro],
      ['mlbam', row.key_mlbam],
      ['fangraphs', row.key_fangraphs],
    ]) {
      if (hasValue(value)) values.push({ source, externalId: String(value).trim() });
    }
  }

  return [...new Map(values.map((value) => [`${value.source}:${value.externalId}`, value])).values()]
    .sort((left, right) => left.source.localeCompare(right.source) || left.externalId.localeCompare(right.externalId));
}

function buildKnownRegressionCases(recommendations) {
  const labels = ['David Ortiz', 'Mariano Rivera', 'Ben Taylor'];

  return labels.map((label) => ({
    label,
    recommendations: recommendations
      .filter((entry) => normalizeName(entry.displayName) === normalizeName(label))
      .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId)),
  }));
}

function renderMarkdown(report) {
  const lines = [
    '# Identity Disposition Recommendations',
    '',
    'These are deterministic review recommendations. They do not modify the live player universe or automatically write editorial decisions.',
    '',
    '## Summary',
    '',
    '| Disposition | Count |',
    '| --- | ---: |',
    `| Review as possible MLB identity | ${report.summary.reviewMlbIdentityCount} |`,
    `| Review distinct external identity | ${report.summary.reviewExternalIdentityCount} |`,
    `| Exclude as unverified/non-MLB | ${report.summary.excludeUnverifiedNonMlbCount} |`,
    `| Manual strong-ID conflict | ${report.summary.manualConflictCount} |`,
    '',
    '## Decision rules',
    '',
    '- Raw Chadwick MLB playing years require identity review rather than exclusion.',
    '- Baseball-Reference or Retrosheet IDs require separate identity review and are never merged by name.',
    '- MLBAM or FanGraphs IDs alone do not prove that a player reached MLB.',
    '- A professional career without an MLB playing range is excluded from the MLB game universe unless reviewed.',
    '- Empty same-name records are excluded rather than inheriting a famous player’s identity or statistics.',
    '',
    '## Known regression cases',
    '',
  ];

  for (const regressionCase of report.knownRegressionCases) {
    lines.push(`### ${regressionCase.label}`, '');

    for (const entry of regressionCase.recommendations) {
      const evidence = entry.evidenceSummary;
      lines.push(`- \`${entry.canonicalId}\` / ${entry.legacyPlayerIds.join(', ')} — **${entry.recommendedDisposition}**: ${entry.reason}`);
      lines.push(`  - Birth: ${evidence.birthDates.join(', ') || 'unknown'}; raw MLB: ${evidence.rawMlbRanges.join(', ') || 'none'}; raw pro: ${evidence.rawProRanges.join(', ') || 'none'}; IDs: ${evidence.externalIds.map((id) => `${id.source}=${id.externalId}`).join(', ') || 'none'}`);
    }
    lines.push('');
  }

  lines.push('## Full recommendations', '');
  for (const entry of report.recommendations) {
    lines.push(`- **${entry.displayName}** — \`${entry.canonicalId}\`; ${entry.recommendedDisposition}; legacy IDs: ${entry.legacyPlayerIds.join(', ')}`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function formatBirthDate(row) {
  if (!hasValue(row.birth_year)) return '';
  return [row.birth_year, row.birth_month || '??', row.birth_day || '??'].join('-');
}

function formatMlbRange(row) {
  if (!hasValue(row.mlb_played_first) && !hasValue(row.mlb_played_last)) return '';
  return `${row.mlb_played_first || '?'}–${row.mlb_played_last || '?'}`;
}

function formatProRange(row) {
  if (!hasValue(row.pro_played_first) && !hasValue(row.pro_played_last)) return '';
  return `${row.pro_played_first || '?'}–${row.pro_played_last || '?'}`;
}

function hasValue(value) {
  return String(value ?? '').trim().length > 0;
}

function countBy(values, getKey) {
  const counts = {};
  for (const value of values) {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
