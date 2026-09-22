import type {
  DailyNineScorecardComparisonState,
  DailyNineScorecardComparisons,
} from './useDailyNineScorecardComparisons';

export function createDailyNineScorecardAtBatAverage(
  state: DailyNineScorecardComparisonState | undefined,
): string | null {
  if (state?.status !== 'success'
    || state.resolvedAtBatCount <= 1
    || state.averagePoints === null) return null;

  return state.averagePoints.toFixed(1);
}

export function addDailyNineAtBatAveragesToShareText(
  shareText: string,
  comparisons: DailyNineScorecardComparisons,
): string {
  const lines = shareText.split('\n');
  const firstBlank = lines.indexOf('');
  if (firstBlank < 0) return shareText;

  const scoreLineIndex = firstBlank + 1;
  const pitchSectionStart = lines.indexOf('', scoreLineIndex + 1) + 1;
  if (pitchSectionStart <= 0) return shareText;

  for (let lineIndex = pitchSectionStart, pitchNumber = 1;
    lineIndex < lines.length && lines[lineIndex] !== '';
    lineIndex += 1, pitchNumber += 1) {
    const average = createDailyNineScorecardAtBatAverage(comparisons[pitchNumber]);
    if (average !== null) lines[lineIndex] = `${lines[lineIndex]} · AVG ${average}`;
  }

  return lines.join('\n');
}
