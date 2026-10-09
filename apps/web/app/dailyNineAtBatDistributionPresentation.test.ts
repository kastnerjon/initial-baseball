import { describe, expect, it } from 'vitest';
import { createDailyNineAtBatDistributionPresentation } from './dailyNineAtBatDistributionPresentation';

const example = {
  status: 'success' as const,
  rulesetVersion: 'points-v4' as const,
  ownPoints: 2,
  resolvedAtBatCount: 100,
  averagePoints: 1.72,
  strictLowerAtBatRate: 0.46,
  scoreHistogram: [18, 12, 16, 0, 24, 0, 18, 0, 12],
};

describe('Daily Nine at-bat distribution presentation', () => {
  it('renders the exact six v4 outcome buckets using the authoritative histogram', () => {
    const result = createDailyNineAtBatDistributionPresentation(example);
    expect(result?.sampleSize).toBe(100);
    expect(result?.percentile).toBe(70);
    expect(result?.bars.map(bar => [bar.points, bar.outcome, bar.percent, bar.selected])).toEqual([
      [0, 'K', 18, false],
      [0.5, 'BB', 12, false],
      [1, '1B', 16, false],
      [2, '2B', 24, true],
      [3, '3B', 18, false],
      [4, 'HR', 12, false],
    ]);
    expect(result?.bars.find(bar => bar.selected)?.heightPercent).toBe(100);
  });

  it('uses even one real peer result and preserves the zero-percent other buckets', () => {
    const one = createDailyNineAtBatDistributionPresentation({
      ...example,
      ownPoints: 0,
      resolvedAtBatCount: 1,
      averagePoints: 0,
      strictLowerAtBatRate: 0,
      scoreHistogram: [1, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(one?.percentile).toBe(100);
    expect(one?.bars[0]).toMatchObject({ percent: 100, selected: true });
    expect(one?.bars[1]).toMatchObject({ percent: 0, heightPercent: 0 });
  });

  it('does not invent data for older rulesets, missing histograms or unsupported buckets', () => {
    expect(createDailyNineAtBatDistributionPresentation({ ...example, rulesetVersion: 'points-v3' })).toBeNull();
    const { scoreHistogram: _unusedHistogram, ...withoutHistogram } = example;
    expect(createDailyNineAtBatDistributionPresentation(withoutHistogram)).toBeNull();
    expect(createDailyNineAtBatDistributionPresentation({ ...example, resolvedAtBatCount: 0 })).toBeNull();
    expect(createDailyNineAtBatDistributionPresentation({
      ...example, scoreHistogram: [18, 12, 16, 1, 24, 0, 18, 0, 12],
    })).toBeNull();
    expect(createDailyNineAtBatDistributionPresentation({
      ...example, scoreHistogram: [18, 12, 16, 0, 24, 0, 18, 0, 11],
    })).toBeNull();
  });
});
