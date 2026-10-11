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
    const base = {
      pitch, own: own ?? null, average: '—', beat: '—', percentile: '—', count: 0,
      segments: [] as { score: number; count: number; percent: number; color: number }[],
      marker: null as number | null,
    };
    if (own === undefined || state === undefined || state.status === 'loading') {
      return { ...base, status: 'loading' as const };
    }
    if (state.status !== 'success' || state.rulesetVersion !== V4) {
      return { ...base, status: 'unavailable' as const };
    }
    const bins = state.scoreHistogram;
    const length = 1 + (abRange.maximumPoints - abRange.minimumPoints) / abRange.step;
    if (!validScoreHistogram(bins, state.resolvedAtBatCount, length) || !values.includes(own)
      || bins.some((n, index) => n > 0 && !values.includes(abRange.minimumPoints + index * abRange.step))) {
      return { ...base, status: 'unavailable' as const };
    }
    if (state.resolvedAtBatCount === 0) return { ...base, status: 'empty' as const };
    let cumulative = 0;
    const segments = values.map((score, color) => {
      const count = bins[Math.round((score - abRange.minimumPoints) / abRange.step)] ?? 0;
      const percent = count * 100 / state.resolvedAtBatCount;
      cumulative += percent;
      return { score, color, count, percent, midpoint: cumulative - percent / 2 };
    });
    return {
      ...base, status: 'ready' as const, count: state.resolvedAtBatCount, segments,
      marker: segments.find(seg => seg.score === own)?.midpoint ?? null,
      average: state.averagePoints === null ? '—' : state.averagePoints.toFixed(1),
      beat: createDailyNineScorecardAtBatBeat(own, state) ?? '—',
      percentile: createDailyNineScorecardAtBatPercentile(own, state) ?? '—',
    };
  });
}

export function createFinalDistributionModel(state: DailyNineCompletedComparisonState) {
  const base = {
    own: state.status === 'idle' ? null : state.ownPoints, count: 0,
    min: finalRange.minimumPoints, max: finalRange.maximumPoints, step: finalRange.step,
    bins: [] as { score: number; count: number; percent: number; height: number }[],
    markerIndex: null as number | null,
  };
  if (state.status === 'idle' || state.status === 'loading') return { ...base, status: 'loading' as const };
  if (state.status !== 'success' || state.rulesetVersion !== V4) return { ...base, status: 'unavailable' as const };
  const length = 1 + (finalRange.maximumPoints - finalRange.minimumPoints) / finalRange.step;
  const own = state.ownPoints;
  if (!validScoreHistogram(state.scoreHistogram, state.completedGameCount, length) || own === null
    || own < finalRange.minimumPoints || own > finalRange.maximumPoints
    || !Number.isInteger((own - finalRange.minimumPoints) / finalRange.step)) {
    return { ...base, status: 'unavailable' as const };
  }
  if (state.completedGameCount === 0) return { ...base, own, status: 'empty' as const };
  const maxCount = Math.max(...state.scoreHistogram);
  return {
    ...base, status: 'ready' as const, own, count: state.completedGameCount,
    markerIndex: (own - finalRange.minimumPoints) / finalRange.step,
    bins: state.scoreHistogram.map((count, i) => ({
      score: finalRange.minimumPoints + i * finalRange.step, count,
      percent: count * 100 / state.completedGameCount,
      height: count === 0 ? 0 : Math.max(2, count * 100 / maxCount),
    })),
  };
}
