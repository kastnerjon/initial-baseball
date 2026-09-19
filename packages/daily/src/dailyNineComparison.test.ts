import { POINTS_V3_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  createDailyNineComparisonService,
  getDailyNineStrictLowerFinishRate,
  type DailyNineComparisonRepository,
} from './dailyNineComparison';

const KEY = {
  puzzleId: 'daily-2026-09-18-editorial-f5f968b7',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
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
    const service = createDailyNineComparisonService(repository());

    await expect(service.getAtBat({ ...KEY, pitchNumber: 4 })).resolves.toEqual({
      ...KEY,
      pitchNumber: 4,
      
      resolvedAtBatCount: 0,
      averagePoints: null,
    });
  });

  it('derives one slot average from provider count and persisted point sum', async () => {
    const repo = repository({
      
      resolvedAtBatCount: 4,
    });
    const service = createDailyNineComparisonService(repo);

    await expect(service.getAtBat({ ...KEY, pitchNumber: 7 })).resolves.toMatchObject({
      resolvedAtBatCount: 4,
      awardedPointsSum: 17,
      averagePoints: 4.25,
      
    });
    expect(repo.readAtBat).toHaveBeenCalledExactlyOnceWith({ ...KEY, pitchNumber: 7 });
  });

  it('keeps partial-game slot populations independent', async () => {
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
      averagePoints: 5,
    });
    await expect(ninth.getAtBat({ ...KEY, pitchNumber: 9 })).resolves.toMatchObject({
      resolvedAtBatCount: 3,
      averagePoints: 3,
    });
  });

  it('rejects malformed slot statistics instead of publishing impossible averages', async () => {
    const impossible = createDailyNineComparisonService(repository({
      
      resolvedAtBatCount: 2,
      awardedPointsSum: 15,
    }));
    await expect(impossible.getAtBat({ ...KEY, pitchNumber: 2 }))
      .rejects.toThrow('exceeds the points-v3 slot maximum');

    const pointsWithoutRows = createDailyNineComparisonService(repository({
      
      resolvedAtBatCount: 0,
      awardedPointsSum: 1,
    }));
    await expect(pointsWithoutRows.getAtBat({ ...KEY, pitchNumber: 2 }))
      .rejects.toThrow('cannot have points without resolved at-bats');
  });

  it('builds a bounded 0-63 histogram and null empty completed-game average', async () => {
    const service = createDailyNineComparisonService(repository());

    const comparison = await service.getCompletedGames(KEY);

    expect(comparison.completedGameCount).toBe(0);
    expect(comparison.averageTotalPoints).toBeNull();
    expect(comparison.scoreHistogram).toHaveLength(64);
    expect(comparison.scoreHistogram.every(count => count === 0)).toBe(true);
  });

  it('merges score buckets and derives completed-game average from the independent population', async () => {
    const service = createDailyNineComparisonService(repository(
      undefined,
      {
        
        scoreBuckets: [
          { points: 10, count: 2 },
          { points: 20, count: 3 },
          { points: 20, count: 1 },
          { points: 63, count: 1 },
        ],
      },
    ));

    const comparison = await service.getCompletedGames(KEY);

    expect(comparison.completedGameCount).toBe(7);
    expect(comparison.averageTotalPoints).toBe(163 / 7);
    expect(comparison.scoreHistogram[10]).toBe(2);
    expect(comparison.scoreHistogram[20]).toBe(4);
    expect(comparison.scoreHistogram[63]).toBe(1);
  });

  it('implements strict-lower finishers semantics and excludes ties from the numerator', async () => {
    const service = createDailyNineComparisonService(repository(
      undefined,
      {
        
        scoreBuckets: [
          { points: 10, count: 2 },
          { points: 20, count: 3 },
          { points: 30, count: 1 },
        ],
      },
    ));
    const comparison = await service.getCompletedGames(KEY);

    expect(getDailyNineStrictLowerFinishRate(comparison, 20)).toBe(2 / 6);
    expect(getDailyNineStrictLowerFinishRate(comparison, 10)).toBe(0);
    expect(getDailyNineStrictLowerFinishRate(comparison, 31)).toBe(1);
  });

  it('returns null strict-lower rate for an empty completed population', async () => {
    const comparison = await createDailyNineComparisonService(repository()).getCompletedGames(KEY);
    expect(getDailyNineStrictLowerFinishRate(comparison, 40)).toBeNull();
  });

  it('keeps at-bat and completed-game reads separate', async () => {
    const repo = repository(
      { resolvedAtBatCount: 8, awardedPointsSum: 32 },
      { scoreBuckets: [{ points: 40, count: 2 }] },
    );
    const service = createDailyNineComparisonService(repo);

    await service.getAtBat({ ...KEY, pitchNumber: 5 });
    expect(repo.readCompletedGames).not.toHaveBeenCalled();

    await service.getCompletedGames(KEY);
    expect(repo.readAtBat).toHaveBeenCalledTimes(1);
    expect(repo.readCompletedGames).toHaveBeenCalledExactlyOnceWith(KEY);
  });

  it('rejects invalid score buckets and unsafe aggregate integers', async () => {
    const invalidScore = createDailyNineComparisonService(repository(
      undefined,
      { scoreBuckets: [{ points: 64, count: 1 }] },
    ));
    await expect(invalidScore.getCompletedGames(KEY)).rejects.toThrow('between 0 and 63');

    const unsafeCount = createDailyNineComparisonService(repository(undefined, { scoreBuckets: [{ points: 20, count: Number.MAX_SAFE_INTEGER + 1 }] }));
    await expect(unsafeCount.getCompletedGames(KEY)).rejects.toThrow('positive safe integer');
  });
});
