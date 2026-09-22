import {
  formatDailyScorecardPoints,
  type DailyScorecardPoints,
} from './dailyScorecard';
import { createDailyNineCompletedComparisonPresentation } from './dailyNineCompletedComparisonPresentation';
import type { DailyNineCompletedComparisonState } from './useDailyNineCompletedComparison';
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

export function createDailyNineScorecardShareText(
  shareText: string,
  totalPoints: number,
  completedComparison: DailyNineCompletedComparisonState,
  points: DailyScorecardPoints,
  comparisons: DailyNineScorecardComparisons,
): string {
  const lines = shareText.split('\n');
  const firstBlank = lines.indexOf('');
  if (firstBlank < 0) return shareText;

  const scoreLineIndex = firstBlank + 1;
  const completedAverage = createDisplayableCompletedAverage(completedComparison);
  lines[scoreLineIndex] = completedAverage === null
    ? `${formatDailyScorecardPoints(totalPoints)} PTS`
    : `${formatDailyScorecardPoints(totalPoints)} PTS • AVG ${completedAverage}`;

  const pitchSectionStart = lines.indexOf('', scoreLineIndex + 1) + 1;
  if (pitchSectionStart <= 0) return lines.join('\n');

  for (let lineIndex = pitchSectionStart, pitchNumber = 1;
    lineIndex < lines.length && lines[lineIndex] !== '';
    lineIndex += 1, pitchNumber += 1) {
    const awardedPoints = points[pitchNumber];
    if (awardedPoints === undefined) continue;

    const currentLine = lines[lineIndex] ?? '';
    const separatorIndex = currentLine.indexOf(':');
    if (separatorIndex <= 0) continue;

    const initials = currentLine.slice(0, separatorIndex).trim();
    const personalScore = formatDailyScorecardPoints(awardedPoints);
    const average = createDailyNineScorecardAtBatAverage(comparisons[pitchNumber]);
    lines[lineIndex] = average === null
      ? `${initials}: ${personalScore}`
      : `${initials}: ${personalScore} • AVG: ${average}`;
  }

  return lines.join('\n');
}

function createDisplayableCompletedAverage(
  state: DailyNineCompletedComparisonState,
): string | null {
  if (state.status === 'idle') return null;
  const average = createDailyNineCompletedComparisonPresentation(state).average;
  return average === '—' ? null : average;
}
