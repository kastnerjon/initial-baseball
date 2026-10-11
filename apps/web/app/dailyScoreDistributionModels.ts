import { getDailyOutcomePoints, getDailyPointsRange } from '@initial-baseball/engine';
import { POINTS_V4_DAILY_RULESET_VERSION as V4 } from '@initial-baseball/shared';
import type { DailyScorecardPoints } from './dailyScorecard';
import type { DailyNineScorecardComparisons } from './useDailyNineScorecardComparisons';
import type { DailyNineCompletedComparisonState } from './useDailyNineCompletedComparison';
import { createDailyNineScorecardAtBatBeat, createDailyNineScorecardAtBatPercentile } from './dailyNineScorecardComparisonPresentation';

const outcomes = ['K', 'BB', '1B', '2B', '3B', 'HR'] as const;
const values = outcomes.map(outcome => getDailyOutcomePoints(V4, outcome));
const abRange = getDailyPointsRange(V4, 1)!;
const finalRange = getDailyPointsRange(V4, 9)!;
export const scoreValueLabels = values;

export function validScoreHistogram(bins: number[] | undefined, count: number, length: number): bins is number[] {
  return Array.isArray(bins) && bins.length === length && Number.isSafeInteger(count) && count >= 0
    && bins.every(n => Number.isSafeInteger(n) && n >= 0)
    && bins.reduce((sum, n) => sum + n, 0) === count;
}

export function createAtBatDistributionModels(points: DailyScorecardPoints, comparisons: DailyNineScorecardComparisons) {
  return Array.from({ length: 9 }, (_, i) => {
    const pitch = i + 1;
    const own = points[pitch];
    const state = comparisons[pitch];
    const base = { pitch, own: own ?? null, average: 'â€”', beat: 'â€”', percentile:¶»§q«^