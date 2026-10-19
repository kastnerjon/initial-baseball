/**
 * Sourced from completed canonical regular-season cards, never from game-time
 * MLB API calls. One card per player/season means multi-team seasons are not
 * double counted. A known zero is a valid peak; wholly missing data is null.
 */
export function deriveRegularSeasonPeaks(seasons) {
  return {
    homeRuns: highestSeasonCount(seasons, 'batting', 'homeRuns'),
    strikeouts: highestSeasonCount(seasons, 'pitching', 'strikeouts'),
  };
}

function highestSeasonCount(seasons, line, field) {
  let peak = null;
  for (const season of seasons) {
    const value = season?.[line]?.[field];
    const year = season?.season;
    if (!Number.isSafeInteger(year) || year < 1 || !Number.isSafeInteger(value) || value < 0) continue;
    if (peak === null || value > peak.value || (value === peak.value && year < peak.season)) {
      peak = { season: year, value };
    }
  }
  return peak;
}
