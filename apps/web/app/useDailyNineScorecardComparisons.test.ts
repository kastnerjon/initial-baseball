import { describe, expect, it } from 'vitest';
import { createDailyNineScorecardComparisonRequestPlan } from './useDailyNineScorecardComparisons';

const requestedPitchNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('Daily Nine comparison preload request plan', () => {
  it('queues requested slots before any at-bat is completed while preserving bounded concurrency', () => {
    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers,
      completedPitchNumbers: [],
      comparisons: {},
      completionAdvanced: false,
    })).toEqual([1, 2, 3]);

    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers,
      completedPitchNumbers: [],
      comparisons: {
        1: success(12, 2.5),
        2: success(12, 2.4),
        3: success(12, 2.3),
      },
      completionAdvanced: false,
    })).toEqual([4, 5, 6]);
  });

  it('does not let queued reads exceed the concurrency cap', () => {
    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers,
      completedPitchNumbers: [],
      comparisons: {
        1: { status: 'loading' },
        2: { status: 'loading' },
        3: { status: 'loading' },
      },
      completionAdvanced: false,
    })).toEqual([]);
  });

  it('refreshes only eligible completed slots when gameplay advances', () => {
    expect(createDailyNineScorecardComparisonRequestPlan({
      requestedPitchNumbers: [1, 2, 3],
      completedPitchNumbers: [1, 2],
      comparisons: {
        1: success(1, 4),
        2: { status: 'unavailable' },
        3: success(1, 3),
      },
      completionAdvanced: true,
    })).toEqual([1, 2]);
  });
});

function success(resolvedAtBatCount: number, averagePoints: number) {
  return {
    status: 'success' as const,
    resolvedAtBatCount,
    averagePoints,
  };
}
