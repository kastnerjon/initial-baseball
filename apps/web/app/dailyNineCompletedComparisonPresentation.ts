import type { DailyNineCompletedComparisonState } from './useDailyNineCompletedComparison';

export type DailyNineScorecardAverage = {
  label: 'Early AVG' | 'AVG';
  value: string;
  note: string;
  shareLine: string;
};

export function createDailyNineCompletedComparisonPresentation(
  state: Exclude<DailyNineCompletedComparisonState, { status: 'idle' }>,
): { average: string; beat: string | null; note: string } {
  if (state.status === 'loading') {
    return { average: '—', beat: null, note: 'Loading comparison…' };
  }
  if (state.status === 'unavailable') {
    return { average: '—', beat: null, note: 'Comparison unavailable' };
  }

  const { completedGameCount: count, averageTotalPoints, strictLowerFinishRate } = state;
  if (count <= 1) {
    return {
      average: '—',
      beat: null,
      note: count === 0
        ? 'Waiting for more completed results'
        : 'Waiting for more completed results · 1 result',
    };
  }
  if (averageTotalPoints === null) {
    return { average: '—', beat: null, note: 'Comparison unavailable' };
  }

  const average = averageTotalPoints.toFixed(1);
  if (count < 10) {
    return { average, beat: null, note: `Early average · ${count} completed results` };
  }
  if (count < 20) {
    return { average, beat: null, note: `${count} completed results · BEAT appears at 20` };
  }

  return {
    average,
    beat: strictLowerFinishRate === null ? null : `${Math.round(strictLowerFinishRate * 100)}%`,
    note: `${count} completed results · ties aren't counted as beaten`,
  };
}

export function createDailyNineScorecardAverage(
  state: DailyNineCompletedComparisonState,
): DailyNineScorecardAverage | null {
  if (state.status !== 'success'
    || state.completedGameCount <= 1
    || state.averageTotalPoints === null) return null;

  const value = state.averageTotalPoints.toFixed(1);
  const label = state.completedGameCount < 10 ? 'Early AVG' : 'AVG';
  const note = `${state.completedGameCount} completed results`;

  return {
    label,
    value,
    note,
    shareLine: `${label} ${value} · ${note}`,
  };
}

export function addDailyNineAverageToShareText(
  shareText: string,
  average: DailyNineScorecardAverage | null,
): string {
  if (average === null) return shareText;

  const lines = shareText.split('\n');
  const firstBlankLine = lines.indexOf('');
  if (firstBlankLine < 0 || firstBlankLine + 1 >= lines.length) {
    return `${shareText}\n${average.shareLine}`;
  }

  lines.splice(firstBlankLine + 2, 0, average.shareLine);
  return lines.join('\n');
}
