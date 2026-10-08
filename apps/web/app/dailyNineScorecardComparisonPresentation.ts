import type { DailySharePitchLine } from '@initial-baseball/shared';
import {
  formatDailyScorecardPoints,
  type DailyScorecardPoints,
} from './dailyScorecard';
import { createDailyNineCompletedComparisonPresentation } from './dailyNineCompletedComparisonPresentation';
import type { DailyNineCompletedComparisonState } from './useDailyNineCompletedComparison';
import { createDailyNineAtBatComparisonState } from './dailyNineAtBatComparisonState';
import type {
  DailyNineScorecardComparisonState,
  DailyNineScorecardComparisons,
} from './useDailyNineScorecardComparisons';

export type DailyNineScorecardRow = {
  pitchNumber: number;
  initials: string;
  outcome: DailySharePitchLine['outcome'];
  score: string;
  average: string;
  beat: string;
};

export function createDailyNineScorecardAtBatAverage(
  state: DailyNineScorecardComparisonState | undefined,
): string | null {
  if (state?.status !== 'success'
    || state.resolvedAtBatCount === 0
    || state.averagePoints === null) return null;

  return state.averagePoints.toFixed(1);
}

/** The same strict-lower, ties-not-beaten comparison as the terminal at-bat UI. */
export function createDailyNineScorecardAtBatBeat(
  ownPoints: number | undefined,
  comparison: DailyNineScorecardComparisonState | undefined,
): string | null {
  if (ownPoints === undefined) return null;
  const state = createDailyNineAtBatComparisonState(comparison, ownPoints);
  return state.status === 'success' && state.strictLowerAtBatRate !== null
    ? `${Math.round(state.strictLowerAtBatRate * 100)}%`
    : null;
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
      outcome: line.outcome,
      score: awardedPoints === undefined ? '—' : formatDailyScorecardPoints(awardedPoints),
      average: average ?? '—',
      beat: createDailyNineScorecardAtBatBeat(awardedPoints, comparisons[pitchNumber]) ?? '—',
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
  const completedPresentation = completedComparison.status === 'idle'
    ? null
    : createDailyNineCompletedComparisonPresentation(completedComparison);
  const completedAverage = completedPresentation?.average === '—' ? null : completedPresentation?.average ?? null;
  const completedBeat = completedPresentation?.beat ?? null;
  lines[scoreLineIndex] = [
    `${formatDailyScorecardPoints(totalPoints)} PTS`,
    ...(completedAverage === null ? [] : [`AVG ${completedAverage}`]),
    ...(completedBeat === null ? [] : [`BEAT ${completedBeat}`]),
  ].join(' • ');

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
  const beatWidth = Math.max('BEAT %'.length, ...rows.map(row => row.beat.length));
  const gap = '   ';

  const header = `${''.padEnd(labelWidth)}${gap}${'SCORE'.padStart(scoreWidth)}${gap}${'AVG'.padStart(averageWidth)}${gap}${'BEAT %'.padStart(beatWidth)}`;
  const body = rows.map(row => (
    `${`${row.initials}:`.padEnd(labelWidth)}${gap}${row.score.padStart(scoreWidth)}${gap}${row.average.padStart(averageWidth)}${gap}${row.beat.padStart(beatWidth)}`
  ));

  return [header, ...body];
}

