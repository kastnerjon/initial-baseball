const REQUIRED_OBP_FIELDS = ['hits', 'walks', 'hitByPitch', 'atBats'];
const REQUIRED_SLG_FIELDS = ['hits', 'doubles', 'triples', 'homeRuns', 'atBats'];

function seasonHadNoSacrificeFlyRule(season) {
  return Number.isInteger(season)
    && ((season >= 1931 && season <= 1938) || (season >= 1940 && season <= 1953));
}

export function hasCompleteObpSource(rows) {
  return rows.length > 0 && rows.every(row => (
    REQUIRED_OBP_FIELDS.every(field => Number.isFinite(row[field]))
    && (
      Number.isFinite(row.sacrificeFlies)
      || (row.sacrificeFlies == null && seasonHadNoSacrificeFlyRule(row.season))
    )
  ));
}

export function hasCompleteSluggingSource(rows) {
  return rows.length > 0 && rows.every(row => (
    REQUIRED_SLG_FIELDS.every(field => Number.isFinite(row[field]))
  ));
}

export function deriveOnBasePercentage(stats) {
  // The rule was absent in 1931–1938 and 1940–1953, so missing SF in those
  // seasons is not a missing event count and does not enter historical OBP.
  const sacrificeFlies = Number.isFinite(stats.sacrificeFlies)
    ? stats.sacrificeFlies
    : stats.sacrificeFlies == null && seasonHadNoSacrificeFlyRule(stats.season)
      ? 0
      : null;

  if (
    !REQUIRED_OBP_FIELDS.every(field => Number.isFinite(stats[field]))
    || sacrificeFlies === null
  ) {
    return null;
  }

  const denominator = stats.atBats + stats.walks + stats.hitByPitch + sacrificeFlies;
  return denominator > 0
    ? (stats.hits + stats.walks + stats.hitByPitch) / denominator
    : null;
}

export function deriveCareerOnBasePercentage(careerTotals, sourceRows) {
  if (!hasCompleteObpSource(sourceRows)) return null;

  const sacrificeFlies = sourceRows.reduce((total, row) => (
    total + (Number.isFinite(row.sacrificeFlies) ? row.sacrificeFlies : 0)
  ), 0);

  return deriveOnBasePercentage({ ...careerTotals, sacrificeFlies });
}

export function deriveSluggingPercentage(stats) {
  if (!REQUIRED_SLG_FIELDS.every(field => Number.isFinite(stats[field])) || stats.atBats <= 0) {
    return null;
  }

  const totalBases = stats.hits + stats.doubles + (2 * stats.triples) + (3 * stats.homeRuns);
  return totalBases / stats.atBats;
}
