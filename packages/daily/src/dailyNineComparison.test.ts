import { POINTS_V3_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateDailyNineComparison,
  createDailyNineComparisonService,
  type DailyNineAtBatFactBucket,
  type DailyNineComparisonPopulation,
} from './dailyNineComparison';

const KEY = {
  puzzleId: 'daily-2026-09-17-editorial-69effd88',
  puzzleDate: '2026-09-17',
  puzzleNumber: 144,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
} as const;

describe('Daily Nine comparison aggregation', () => {
  it('returns a stable empty nine-slot shape for an empty population', () => {
    const comparison = aggregateDailyNineComparison({
      scoreBuckets: [],
      atBatFactBuckets: [],
    });

    expect(comparison.completionCount).toBe(0);
    expect(comparison.averageTotalPoints).toBe(0);
    expect(comparison.scoreDistribution).toEqual([]);
    expect(comparison.atBats).toHaveLength(9);
    expect(comparison.atBats[0]).toMatchObject({
      pitchNumber: 1,
      sampleSize: 0,
      averagePoints: 0,
      averageHintsRevealed: 0,
      hintUseRate: 0,
    });
    expect(comparison.atBats[8]?.pitchNumber).toBe(9);
  });

  it('derives score distribution and per-at-bat rates without duplicating scoring', () => {
    const comparison = aggregateDailyNineComparison(twoPlayerPopulation());

    expect(comparison.completionCount).toBe(2);
    expect(comparison.averageTotalPoints).toBe(31.5);
    expect(comparison.scoreDistribution).toEqual([
      { points: 0, count: 1, rate: 0.5 },
      { points: 63, count: 1, rate: 0.5 },
    ]);
    for (const atBat of comparison.atBats) {
      expect(atBat.sampleSize).toBe(2);
      expect(atBat.averagePoints).toBe(3.5);
      expect(atBat.hintUseRate).toBe(0);
      expect(atBat.outcomeRates.HR).toBe(0.5);
      expect(atBat.outcomeRates.K).toBe(0.5);
      expect(atBat.resolutionRates.correct).toBe(0.5);
      expect(atBat.resolutionRates.give_up).toBe(0.5);
    }
  });

  it('uses engine points-v3 deductions for grouped native facts', () => {
    const factBuckets = uniformAtBats([
      {
        outcome: '2B',
        hintsRevealed: 1,
        wrongGuesses: 2,
        resolution: 'correct',
        count: 1,
      },
    ]);
    const comparison = aggregateDailyNineComparison({
      scoreBuckets: [{ points: 36, count: 1 }],
      atBatFactBuckets: factBuckets,
    });

    expect(comparison.atBats[0]).toMatchObject({
      averagePoints: 4,
      averageHintsRevealed: 1,
      hintUseRate: 1,
    });
    expect(comparison.atBats[0]?.outcomeRates['2B']).toBe(1);
  });

  it('rejects a provider population missing a completed slot', () => {
    const population = twoPlayerPopulation();
    population.atBatFactBuckets = population.atBatFactBuckets
      .filter(bucket => bucket.pitchNumber !== 9);

    expect(() => aggregateDailyNineComparison(population))
      .toThrow('population mismatch at pitch 9');
  });

  it('keeps identity scoping in the repository service boundary', async () => {
    const population = twoPlayerPopulation();
    const repository = {
      readPopulation: vi.fn().mockResolvedValue(population),
    };
    const service = createDailyNineComparisonService(repository);

    await expect(service.get(KEY)).resolves.toMatchObject({
      ...KEY,
      completionCount: 2,
      averageTotalPoints: 31.5,
    });
    expect(repository.readPopulation).toHaveBeenCalledWith(KEY);
  });
});

function twoPlayerPopulation(): DailyNineComparisonPopulation {
  return {
    scoreBuckets: [
      { points: 63, count: 1 },
      { points: 0, count: 1 },
    ],
    atBatFactBuckets: uniformAtBats([
      {
        outcome: 'HR',
        hintsRevealed: 0,
        wrongGuesses: 0,
        resolution: 'correct',
        count: 1,
      },
      {
        outcome: 'K',
        hintsRevealed: 0,
        wrongGuesses: 0,
        resolution: 'give_up',
        count: 1,
      },
    ]),
  };
}

function uniformAtBats(
  buckets: Omit<DailyNineAtBatFactBucket, 'pitchNumber'>[],
): DailyNineAtBatFactBucket[] {
  return Array.from({ length: 9 }, (_, index) => buckets.map(bucket => ({
    pitchNumber: index + 1,
    ...bucket,
  }))).flat();
}
