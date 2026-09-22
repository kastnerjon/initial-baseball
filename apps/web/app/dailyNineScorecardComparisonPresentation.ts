import type { DailySharePitchLine } from '@initial-baseball/shared';
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

export type DailyNineScorecardRow = {
  pitchNumber: number;
  initials: string;
  score: string;
  average: string;
};

export function createDailyNineScorecardAtBatAverage(
  state: DailyNineScorecardComparisonState | undefined,
): string | null {
  if (state?.status !== 'success'
    || state.resolvedAtBatCount <= 1
    || state.averagePoints === null) return null;

  return state.averagePoints.toFixed(1);
}

export function createDailyNineScorecardRows(
  pitchLines: DailySharePitchLine[],
  points: DailyScorecardPoints,
  comparisons: DailyNineScorecardComparisons,
): DailyNineScorecardRow[] {
  return pitchLines.map((line, index) => {
    const pitchNumber = index + 1;
    const awardedPoints = points[pitchNumber];
    const average = createDailyNineScorecardAtBatAverage(comparisons[pitchNumber]);

    return {
      pitchNumber,
      initials: line.initials,
      score: awardedPoints === undefined ? '—' : formatDailyScorecardPoints(awardedPoints),
      average: average ?? '—',
    };
  });
}

export function createDailyNineScorecardShareText(
  shareText: string,
  totalPoints: number,
  completedComparison: DailyNineCompletedComparisonState,
  pitchLines: DailySharePitchLine[],
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

  const pitchSectionEnd = lines.indexOf('', pitchSectionStart);
  if (pitchSectionEnd < 0) return lines.join('\n');

  const rows = createDailyNineScorecardRows(pitchLines, points, comparisons);
  lines.splice(
    pitchSectionStart,
    pitchSectionEnd - pitchSectionStart,
    ...formatDailyNineScorecardShareTable(rows),
  );

  return lines.join('\n');
}

export function formatDailyNineScorecardShareTable(
  rows: DailyNineScorecardRow[],
): string[] {
  if (rows.length === 0) return [];

  const labelWidth = Math.max(4, ...rows.map(row => row.initials.length + 1));
  const scoreWidth = Math.max('SCORE'.length, ...rows.map(row => row.score.length));
  const averageWidth = Math.max('AVG'.length, ...rows.map(row => row.average.length));
  const gap = '   ';

  const header = `${''.padEnd(labelWidth)}${gap}${'SCORE'.padStart(scoreWidth)}${gap}${'AVG'.padStart(averageWidth)}`;
  const body = rows.map(row => (
    `${`${row.initials}:`.padEnd(labelWidth)}${gap}${row.score.padStart(scoreWidth)}${gap}${row.average.padStart(averageWidth)}`
  ));

  return [header, ...body];
}

function createDisplayableCompletedAverage(
  state: DailyNineCompletedComparisonState,
): string | null {
  if (state.status === 'idle') return null;
  const average = createDailyNineCompletedComparisonPresentation(state).average;
  return average === '—' ? null : average;
}
