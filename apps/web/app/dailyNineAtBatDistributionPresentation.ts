import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { getDailyNineInclusiveAtBatPercentile } from '@initial-baseball/daily/comparison';
import type { DailyNineAtBatComparisonState } from './dailyNineAtBatComparisonState';

type SuccessfulAtBat = Extract<DailyNineAtBatComparisonState, { status: 'success' }>;

export type DailyNineDistributionBar = {
  points: number;
  outcome: 'K' | 'BB' | '1B' | '2B' | '3B' | 'HR';
  count: number;
  percent: number;
  heightPercent: number;
  selected: boolean;
};

export type DailyNineDistributionPresentation = {
  sampleSize: number;
  bars: DailyNineDistributionBar[];
  percentile: number;
};

/**
 * Present the existing authoritative, exact-ruleset histogram.
 * The v4 engine allows 0, 0.5, 1, 2, 3 and 4 outcome scores.
 * A corrupt or incompatible histogram is withheld rather than displayed misleadingly.
 */
export function createDailyNineAtBatDistributionPresentation(
  state: SuccessfulAtBat,
): DailyNineDistributionPresentation | null {
  const { rulesetVersion, scoreHistogram: histogram, resolvedAtBatCount: total } = state;
  if (rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION
    || histogram === undefined
    || histogram.length !== 9
    || !Number.isSafeInteger(total)
    || total <= 0) return null;

  if (!histogram.every(count => Number.isSafeInteger(count) && count >= 0)
    || histogram.reduce((sum, count) => sum + count, 0) !== total
    || histogram[3] !== 0 || histogram[5] !== 0 || histogram[7] !== 0) return null;

  const categories = [
    { points: 0, outcome: 'K', index: 0 },
    { points: 0.5, outcome: 'BB', index: 1 },
    { points: 1, outcome: '1B', index: 2 },
    { points: 2, outcome: '2B', index: 4 },
    { points: 3, outcome: '3B', index: 6 },
    { points: 4, outcome: 'HR', index: 8 },
  ] as const;
  if (!categories.some(category => category.points === state.ownPoints)) return null;

  const inclusiveRate = getDailyNineInclusiveAtBatPercentile({
    rulesetVersion, resolvedAtBatCount: total, scoreHistogram: histogram,
  }, state.ownPoints);
  if (inclusiveRate === null) return null;
  const maxCount = Math.max(...categories.map(category => histogram[category.index] ?? 0));
  return {
    sampleSize: total,
    percentile: Math.round(inclusiveRate * 100),
    bars: categories.map(category => {
      const count = histogram[category.index] ?? 0;
      return {
        points: category.points,
        outcome: category.outcome,
        count,
        percent: Math.round((count / total) * 100),
        heightPercent: count === 0 ? 0 : Math.max(3, Math.round((count / maxCount) * 100)),
        selected: category.points === state.ownPoints,
      };
    }),
  };
}
