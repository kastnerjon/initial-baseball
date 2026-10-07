import { describe, expect, it } from 'vitest';
import {
  createDailyNineScorecardComparisonRequestPlan,
  getNewlyCompletedPitchNumbers,
  shouldScheduleCompletedPitchRetry,
} from './useDailyNineScorecardComparisons';

const requestedPitchNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('Daily Nine comparison preload request plan', () => {
  it('queues requested slots before any at-bat is completed while preserving bounded concurrency', () => {
    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers,
      pendingRefreshPitchNumbers: [],
      comparisons: {},
    })).toEqual([1, 2, 3]);

    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers,
      pendingRefreshPitchNumbers: [],
      comparisons: {
        1: success(12, 2.5),
        2: success(12, 2.4),
        3: success(12, 2.3),
      },
    })).toEqual([4, 5, 6]);
  });

  it('does not let queued reads exceed the concurrency cap', () => {
    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers,
      pendingRefreshPitchNumbers: [],
      comparisons: {
        1: { status: 'loading' },
        2: { status: 'loading' },
        3: { status: 'loading' },
      },
    })).toEqual([]);
  });

  it('refreshes only eligible completed slots when gameplay advances', () => {
    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers: [1, 2, 3],
      pendingRefreshPitchNumbers: [1, 2],
      comparisons: {
        1: success(0, null),
        2: { status: 'unavailable' },
        3: success(1, 3),
      },
    })).toEqual([1, 2]);
  });

  it('prioritizes a completed-slot refresh ahead of still-missing future preloads', () => {
    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers,
      pendingRefreshPitchNumbers: [1],
      comparisons: {
        1: success(0, null),
        2: success(12, 2.5),
      },
    })).toEqual([1, 3, 4]);
  });
});

describe('Daily Nine completion refresh queue', () => {
  it('keeps newly completed pitches identifiable until a saturated request pool frees capacity', () => {
    expect(getNewlyCompletedPitchNumbers([1], [1, 2])).toEqual([2]);

    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers,
      pendingRefreshPitchNumbers: [2],
      comparisons: {
        1: { status: 'loading' },
        2: success(0, null),
        3: { status: 'loading' },
        4: { status: 'loading' },
      },
    })).toEqual([]);

    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers,
      pendingRefreshPitchNumbers: [2],
      comparisons: {
        1: success(12, 2.5),
        2: success(0, null),
        3: { status: 'loading' },
        4: { status: 'loading' },
      },
    })).toEqual([2]);
  });
});

describe('Daily Nine completed-pitch retry decision', () => {
  it('retries a completed slot only while there are zero other results', () => {
    const noOtherResults = success(0, null);

    expect(shouldScheduleCompletedPitchRetry(1, new Set(), noOtherResults)).toBe(false);
    expect(shouldScheduleCompletedPitchRetry(1, new Set([1]), noOtherResults)).toBe(true);
    expect(shouldScheduleCompletedPitchRetry(1, new Set([1]), success(1, 4))).toBe(false);
  });
});

function success(resolvedAtBatCount: number, averagePoints: number | null) {
  return {
    status: 'success' as const,
    resolvedAtBatCount,
    averagePoints,
  };
}
