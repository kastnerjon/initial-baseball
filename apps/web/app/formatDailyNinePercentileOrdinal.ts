/** Format a rounded inclusive Daily Nine percentile as an English ordinal. */
export function formatDailyNinePercentileOrdinal(percentile: number): string {
  if (!Number.isInteger(percentile) || percentile < 0 || percentile > 100) {
    throw new RangeError('Percentile must be a whole number between 0 and 100');
  }
  const lastTwo = percentile % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th'
    : percentile % 10 === 1 ? 'st'
      : percentile % 10 === 2 ? 'nd'
        : percentile % 10 === 3 ? 'rd' : 'th';
  return `${percentile}${suffix}`;
}
