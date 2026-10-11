import { describe, expect, it } from 'vitest';
import { POINTS_V4_DAILY_RULESET_VERSION as V4 } from '@initial-baseball/shared';
import { createAtBatDistributionModels, createFinalDistributionModel, validScoreHistogram, scoreValueLabels } from './dailyScoreDistributionModels';
import type { DailyNineScorecardComparisons } from './useDailyNineScorecardComparisons';
import type { DailyNineCompletedComparisonState } from './useDailyNineCompletedComparison';

const abBins = (byIndex: Record<number, number> = {}) => Array.from({ length: 9 }, (_, i) => byIndex[i] ?? 0);
const gameBins = (byIndex: Record<number, number> = {}) => Array.from({ length: 73 }, (_, i) => byIndex[i] ?? 0);
function abComparison(bins: number[], count: number, average: number | null): DailyNineScorecardComparisons {
  return { 1: { status: 'success', rulesetVersion: V4, scoreHistogram: bins, resolvedAtBatCount: count, averagePoints: average } };
}
function completion(bins: number[], own: number, count: number): DailyNineCompletedComparisonState {
  return { status: 'success', rulesetVersion: V4, scoreHistogram: bins, ownPoints: own,
    completedGameCount: count, averageTotalPoints: count ? bins.reduce((sum, n, i) => sum + n * i * 0.5, 0) / count : null,
    strictLowerFinishRate: null };
}
describe('actual score-distribution models', () => {
  it('derives point buckets from points-v4, including the walk half-point', () => {
    expect(scoreValueLabels).toEqual([0, 0.5, 1, 2, 3, 4]);
  });
  it('normalizes a single peer and positions user marker within their actual bucket', () => {
    const cols = createAtBatDistributionModels({ 1: 0.5 }, abComparison(abBins({ 1: 1 }), 1, 0.5));
    expect(cols).toHaveLength(9);
    expect(cols[0]!.status).toBe('ready');
    expect(cols[0]!.segments.reduce((sum, segment) => sum + segment.percent, 0)).toBe(100);
    expect(cols[0]!.segments.find(segment => segment.score === 0.5)?.percent).toBe(100);
    expect(cols[0]!.marker).toBe(50);
    expect(cols[0]!.beat).toBe('0%');
    expect(cols[0]!.percentile).toBe('100th');
    expect(cols[1]!.status).toBe('loading');
  });
  it('uses strict-lower BEAT with ties kept in the denominator', () => {
    const cols = createAtBatDistributionModels({ 1: 1 }, abComparison(abBins({ 0: 1, 2: 1, 8: 1 }), 3, 5 / 3));
    expect(cols[0]!.beat).toBe('33%');
    expect(cols[0]!.percentile).toBe('67th');
    expect(cols[0]!.marker).toBeCloseTo(50, 4);
  });
  it('distinguishes empty peers, malformed data, and replay after local reset', () => {
    expect(createAtBatDistributionModels({ 1: 0 }, abComparison(abBins(), 0, null))[0]!.status).toBe('empty');
    expect(createAtBatDistributionModels({ 1: 0 }, abComparison(abBins({ 2: 2 }), 1, 1))[0]!.status).toBe('unavailable');
    expect(createAtBatDistributionModels({}, abComparison(abBins({ 2: 1 }), 1, 1))[0]!.marker).toBeNull();
    expect(createAtBatDistributionModels({ 1: 0 }, { 1: { status: 'unavailable' } })[0]!.status).toBe('unavailable');
  });
  it('preserves sparse, skewed and fractional completed histograms at engine-defined bounds', () => {
    const model = createFinalDistributionModel(completion(gameBins({ 0: 1, 1: 7, 49: 2, 72: 1 }), 24.5, 11));
    expect(model.status).toBe('ready');
    expect(model.bins).toHaveLength(73);
    expect(model.min).toBe(0);
    expect(model.max).toBe(36);
    expect(model.step).toBe(0.5);
    expect(model.markerIndex).toBe(49);
    expect(model.bins[1]!).toMatchObject({ score: 0.5, count: 7 });
    expect(model.bins[49]!.percent).toBeCloseTo(2 / 11 * 100);
    expect(model.bins[2]!.height).toBe(0);
  });
  it('rejects corrupted histograms and withholds empty/unavailable populations', () => {
    expect(validScoreHistogram([1, -1], 0, 2)).toBe(false);
    expect(createFinalDistributionModel(completion(gameBins(), 0, 0)).status).toBe('empty');
    expect(createFinalDistributionModel(completion(gameBins({ 72: 1 }), 36.5, 1)).status).toBe('unavailable');
    expect(createFinalDistributionModel(completion(gameBins({ 72: 1 }), 36, 2)).status).toBe('unavailable');
    expect(createFinalDistributionModel({ status: 'loading', ownPoints: 20 }).status).toBe('loading');
    expect(createFinalDistributionModel({ status: 'unavailable', ownPoints: 20 }).status).toBe('unavailable');
  });
});
