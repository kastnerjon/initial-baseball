import {
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  createDailyNineComparisonService,
  deriveDailyNineAtBatComparison,
  deriveDailyNineCompletedComparison,
  getDailyNineStrictLowerFinishRate,
  type DailyNineComparisonRepository,
} from './dailyNineComparison';

const KEY = {
  puzzleId: 'daily-2026-09-18-editorial-f5f968b7',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
} as const;

const V4_KEY = {
  ...KEY,
  rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
} as const;

function repository(
  atBat = { resolvedAtBatCount: 0, awardedPointsSum: 0 },
  completed = { scoreBuckets: [] as { points: number; count: number }[] },
): DailyNineComparisonRepository {
  return {
    readAtBat: vi.fn().mockResolvedValue(atBat),
    readCompletedGames: vi.fn().mockResolvedValue(completed),
  };
}

describe('Daily Nine comparison service', () => {
  it('returns null for an empty at-bat average without inventing a zero score', async () => {
    await expect(
      createDailyNineComparisonService(repository()).getAtBat({ ...KEY, pitchNumber: 4 }),
    ).resolves.toEqual({
      ...KEY,
      pitchNumber: 4,
      resolvedAtBatCount: 0,
      averagePoints: null,
    });
  });

  it('derives one slot average from provider count and persisted point sum', async () => {
    const repo = repository({ resolvedAtBatCount: 4, awardedPointsSum: 17 });
    const service = createDailyNineComparisonService(repo);

    await expect(service.getAtBat({ ...KEY, pitchNumber: 7 })).resolves.toMatchObject({
      resolvedAtBatCount: 4,
      averagePoints: 4.25,
    });
    expect(repo.readAtBat).toHaveBeenCalledExactlyOnceWith({ ...KEY, pitchNumber: 7 });
  });

  it('routes points-v4 through the widened repository/service port', async () => {
    const repo = repository(
      { resolvedAtBatCount: 3, awardedPointsSum: 4.5 },
      { scoreBuckets: [{ points: 0, count: 1 }, { points: 36, count: 1 }] },
    );
    const service = createDailyNineComparisonService(repo);

    await expect(service.getAtBat({ ...V4_KEY, pitchNumber: 2 })).resolves.toMatchObject({
      ...V4_KEY,
      pitchNumber: 2,
      resolvedAtBatCount: 3,
      averagePoints: 1.5,
    });

    const completed = await service.getCompletedGames(V4_KEY);
    expect(completed.rulesetVersion).toBe(POINTS_V4_DAILY_RULESET_VERSION);
    expect(completed.completedGameCount).toBe(2);
    expect(completed.averageTotalPoints).toBe(18);
    expect(completed.scoreHistogram[0]).toBe(1);
    expect(completed.scoreHistogram[72]).toBe(1);
    expect(repo.readAtBat).toHaveBeenCalledExactlyOnceWith({ ...V4_KEY, pitchNumber: 2 });
    expect(repo.readCompletedGames).toHaveBeenCalledExactlyOnceWith(V4_KEY);
  });

  it('keeps partial-game slot populations independent from completions', async () => {
    const repo = repository(
      { resolvedAtBatCount: 11, awardedPointsSum: 55 },
      { scoreBuckets: [{ points: 30, count: 2 }] },
    );
    const service = createDailyNineComparisonService(repo);

    await expect(service.getAtBat({ ...KEY, pitchNumber: 1 })).resolves.toMatchObject({
      resolvedAtBatCount: 11,
      averagePoints: 5,
    });
    expect(repo.readCompletedGames).not.toHaveBeenCalled();
  });

  it('allows different resolved populations at different slots', async () => {
    const first = createDailyNineComparisonService(repository({
      resolvedAtBatCount: 11,
      awardedPointsSum: 55,
    }));
    const ninth = createDailyNineComparisonService(repository({
      resolvedAtBatCount: 3,
      awardedPointsSum: 9,
    }));

    await expect(first.getAtBat({ ...KEY, pitchNumber: 1 })).resolves.toMatchObject({
      resolvedAtBatCount: 11,
    });
    await expect(ninth.getAtBat({ ...KEY, pitchNumber: 9 })).resolves.toMatchObject({
      resolvedAtBatCount: 3,
    });
  });

  it('rejects impossible at-bat aggregate statistics', async () => {
    const impossible = createDailyNineComparisonService(repository({
      resolvedAtBatCount: 2,
      awardedPointsSum: 15,
    }));
    await expect(impossible.getAtBat({ ...KEY, pitchNumber: 2 }))
      .rejects.toThrow('outside the points-v3 slot range');

    const pointsWithoutRows = createDailyNineComparisonService(repository({
      resolvedAtBatCount: 0,
      awardedPointsSum: 1,
    }));
    await expect(pointsWithoutRows.getAtBat({ ...KEY, pitchNumber: 2 }))
      .rejects.toThrow('cannot have points without resolved at-bats');
  });

  it('validates points-v4 half-point at-bat sums against the exact ruleset range and step', () => {
    expect(deriveDailyNineAtBatComparison(
      { ...V4_KEY, pitchNumber: 2 },
      { resolvedAtBatCount: 3, awardedPointsSum: 4.5 },
    )).toMatchObject({
      ...V4_KEY,
      pitchNumber: 2,
      resolvedAtBatCount: 3,
      averagePoints: 1.5,
    });

    expect(() => deriveDailyNineAtBatComparison(
      { ...V4_KEY, pitchNumber: 2 },
      { resolvedAtBatCount: 3, awardedPointsSum: -0.5 },
    )).toThrow('outside the points-v4 slot range');

    expect(() => deriveDailyNineAtBatComparison(
      { ...V4_KEY, pitchNumber: 2 },
      { resolvedAtBatCount: 3, awardedPointsSum: 12.5 },
    )).toThrow('outside the points-v4 slot range');

    expect(() => deriveDailyNineAtBatComparison(
      { ...V4_KEY, pitchNumber: 2 },
      { resolvedAtBatCount: 3, awardedPointsSum: 4.25 },
    )).toThrow('0.5-point score step');
  });

  it('preserves the points-v3 non-negative at-bat domain', () => {
    expect(() => deriveDailyNineAtBatComparison(
      { ...KEY, pitchNumber: 3 },
      { resolvedAtBatCount: 1, awardedPointsSum: -1 },
    )).toThrow('outside the points-v3 slot range');
    expect(deriveDailyNineAtBatComparison(
      { ...KEY, pitchNumber: 3 },
      { resolvedAtBatCount: 1, awardedPointsSum: 7 },
    ).averagePoints).toBe(7);
  });

  it('builds a bounded 0-63 histogram and null empty completed-game average', async () => {
    const comparison = await createDailyNineComparisonService(repository()).getCompletedGames(KEY);

    expect(comparison.completedGameCount).toBe(0);
    expect(comparison.averageTotalPoints).toBeNull();
    expect(comparison.scoreHistogram).toHaveLength(64);
    expect(comparison.scoreHistogram.every(count => count === 0)).toBe(true);
  });

  it('merges duplicate score buckets and derives completed-game average', async () => {
    const comparison = await createDailyNineComparisonService(repository(undefined, {
      scoreBuckets: [
        { points: 10, count: 2 },
        { points: 20, count: 3 },
        { points: 20, count: 1 },
        { points: 63, count: 1 },
      ],
    })).getCompletedGames(KEY);

    expect(comparison.completedGameCount).toBe(7);
    expect(comparison.averageTotalPoints).toBe(163 / 7);
    expect(comparison.scoreHistogram[10]).toBe(2);
    expect(comparison.scoreHistogram[20]).toBe(4);
    expect(comparison.scoreHistogram[63]).toBe(1);
  });

  it('builds a half-point points-v4 histogram from 0 through 36', () => {
    const comparison = deriveDailyNineCompletedComparison(V4_KEY, {
      scoreBuckets: [
        { points: 0, count: 2 },
        { points: 0.5, count: 3 },
        { points: 1, count: 1 },
        { points: 36, count: 1 },
        { points: 0.5, count: 1 },
      ],
    });

    expect(comparison.completedGameCount).toBe(8);
    expect(comparison.averageTotalPoints).toBe(39 / 8);
    expect(comparison.scoreHistogram).toHaveLength(73);
    expect(comparison.scoreHistogram[0]).toBe(2);
    expect(comparison.scoreHistogram[1]).toBe(4);
    expect(comparison.scoreHistogram[2]).toBe(1);
    expect(comparison.scoreHistogram[72]).toBe(1);
  });

  it('rejects points-v4 completed buckets outside or misaligned to the half-point domain', () => {
    expect(() => deriveDailyNineCompletedComparison(V4_KEY, {
      scoreBuckets: [{ points: -0.5, count: 1 }],
    })).toThrow('between 0 and 36');
    expect(() => deriveDailyNineCompletedComparison(V4_KEY, {
      scoreBuckets: [{ points: 36.5, count: 1 }],
    })).toThrow('between 0 and 36');
    expect(() => deriveDailyNineCompletedComparison(V4_KEY, {
      scoreBuckets: [{ points: 0.25, count: 1 }],
    })).toThrow('0.5-point score step');
  });

  it('implements strict-lower finish semantics and excludes ties from numerator', async () => {
    const comparison = await createDailyNineComparisonService(repository(undefined, {
      scoreBuckets: [
        { points: 10, count: 2 },
        { points: 20, count: 3 },
        { points: 30, count: 1 },
      ],
    })).getCompletedGames(KEY);

    expect(getDailyNineStrictLowerFinishRate(comparison, 20)).toBe(2 / 6);
    expect(getDailyNineStrictLowerFinishRate(comparison, 10)).toBe(0);
    expect(getDailyNineStrictLowerFinishRate(comparison, 31)).toBe(1);
  });

  it('implements strict-lower finish semantics across half-point points-v4 scores', () => {
    const comparison = deriveDailyNineCompletedComparison(V4_KEY, {
      scoreBuckets: [
        { points: 0, count: 2 },
        { points: 0.5, count: 3 },
        { points: 1, count: 1 },
        { points: 4, count: 2 },
      ],
    });

    expect(getDailyNineStrictLowerFinishRate(comparison, 0)).toBe(0);
    expect(getDailyNineStrictLowerFinishRate(comparison, 0.5)).toBe(2 / 8);
    expect(getDailyNineStrictLowerFinishRate(comparison, 1)).toBe(5 / 8);
    expect(getDailyNineStrictLowerFinishRate(comparison, 4)).toBe(6 / 8);
  });

  it('returns null strict-lower rate for an empty completed population', async () => {
    const comparison = await createDailyNineComparisonService(repository()).getCompletedGames(KEY);
    expect(getDailyNineStrictLowerFinishRate(comparison, 40)).toBeNull();
  });

  it('keeps completed-game reads independent from at-bat reads', async () => {
    const repo = repository(
      { resolvedAtBatCount: 8, awardedPointsSum: 32 },
      { scoreBuckets: [{ points: 40, count: 2 }] },
    );
    const service = createDailyNineComparisonService(repo);

    await service.getCompletedGames(KEY);
    expect(repo.readAtBat).not.toHaveBeenCalled();
    expect(repo.readCompletedGames).toHaveBeenCalledExactlyOnceWith(KEY);
  });

  it('rejects invalid score buckets and unsafe aggregate integers', async () => {
    const invalidScore = createDailyNineComparisonService(repository(
      undefined,
      { scoreBuckets: [{ points: 64, count: 1 }] },
    ));
    await expect(invalidScore.getCompletedGames(KEY)).rejects.toThrow('between 0 and 63');

    const unsafeCount = createDailyNineComparisonService(repository(
      undefined,
      { scoreBuckets: [{ points: 20, count: Number.MAX_SAFE_INTEGER + 1 }] },
    ));
    await expect(unsafeCount.getCompletedGames(KEY)).rejects.toThrow('positive safe integer');
  });

  it('rejects malformed histogram input to strict-lower calculation even when empty', () => {
    expect(() => getDailyNineStrictLowerFinishRate({
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      completedGameCount: 0,
      scoreHistogram: [],
    }, 20)).toThrow('invalid length');
  });
});
