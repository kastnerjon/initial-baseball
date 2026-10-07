import type { DailyNineCompletedComparisonState } from './useDailyNineCompletedComparison';

export function createDailyNineCompletedComparisonPresentation(
  state: Exclude<DailyNineCompletedComparisonState, { status: 'idle' }>,
): {
  average: string;
  beat: string | null;
  averageStatus: 'above' | 'at-or-below' | null;
  statusLabel: string | null;
  note: string;
} {
  if (state.status === 'loading') {
    return {
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Loading comparison…',
    };
  }
  if (state.status === 'unavailable') {
    return {
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Comparison unavailable',
    };
  }

  const { completedGameCount: count, averageTotalPoints, strictLowerFinishRate } = state;
  if (count === 0) {
    return {
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Waiting for another completed result',
    };
  }
  if (averageTotalPoints === null) {
    return {
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Comparison unavailable',
    };
  }

  const aboveAverage = state.ownPoints === null ? null : state.ownPoints > averageTotalPoints;
  return {
    average: averageTotalPoints.toFixed(1),
    beat: aboveAverage === null || strictLowerFinishRate === null
      ? null
      : `${Math.round(strictLowerFinishRate * 100)}%`,
    averageStatus: aboveAverage === null ? null : aboveAverage ? 'above' : 'at-or-below',
    statusLabel: aboveAverage === null ? null : aboveAverage ? 'Above AVG' : 'At or below AVG',
    note: `${count} other completed result${count === 1 ? '' : 's'}${strictLowerFinishRate === null ? '' : " · ties aren't counted as beaten"}`,
  };
}
