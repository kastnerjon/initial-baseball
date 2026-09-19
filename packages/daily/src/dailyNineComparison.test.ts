import { POINTS_V3_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  createDailyNineComparisonService,
  getDailyNineStrictLowerFinishersRate,
  type DailyNineComparisonRepository,
} from './dailyNineComparison';

const KEY = {
  puzzleId: 'daily-2026-09-18-editorial-f5f968b7',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
} as const;

function repository(
  atBat = { sourceReadAt: '2026-09-19T05:00:00Z', resolvedAtBatCount: 0, awardedPointsSum: 0 },
  completed = { sourceReadAt: '2026-09-19T05:00:01Z', scoreBuckets: [] as { points: number; count: number }[] },
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
      sourceReadAt: '2026-09-19T05:00:00Z',
      resolvedAtBatCount: 0,
      awardedPointsSum: 0,
      averagePoints: null,
    });
  });

  it('derives one slot average from provider count and persisted point sum', async () => {
    const repo = repository({
      sourceReadAt: '2026-09-19T05:02:00Z',
      resolvedAtBatCount: 4,
      awardedPointsSum: 17,
    });
    const service = createDailyNineComparisonService(repo);

    await expect(service.getAtBat({ ...KEY, pitchNumber: 7 })).resolves.toMatchObject({
      resolvedAtBatCount: 4,
      awardedPointsSum: 17,
      averagePoints: 4.25,
      sourceReadAt: '2026-09-19T05:02:00Z',
    });
    expect(repo.readAtBat).toHaveBeenCalledExactlyOnceWith({ ...KEY, pitchNumber: 7 });
  });

  it('keeps partial-game slot populations independent', async () => {
    const first = createDailyNineComparisonService(repository({
      sourceReadAt: '2026-09-19T05:03:00Z',
      resolvedAtBatCount: 11,
      awardedPointsSum: 55,
    }));
    const ninth = createDailyNineComparisonService(repository({
      sourceReadAt: '2026-09-19T05:03:01Z',
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
      sourceReadAt: '2026-09-19T05:04:00Z',
      resolvedAtBatCount: 2,
      awardedPointsSum: 15,
    }));
    await expect(impossible.getAtBat({ ...KEY, pitchNumber: 2 }))
      .rejects.toThrow('exceeds the points-v3 slot maximum');

    const pointsWithoutRows = createDailyNineComparisonService(repository({
      sourceReadAt: '2026-09-19T05:04:00Z',
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
    expect(comparison.averagePoints).toBeNull();
    expect(comparison.scoreHistogram).toHaveLength(64);
    expect(comparison.scoreHistogram.every(count => count === 0)).toBe(true);
  });

  it('merges score buckets and derives completed-game average from the independent population', async () => {
    const service = createDailyNineComparisonService(repository(
      undefined,
      {
        sourceReadAt: '2026-09-19T05:05:00Z',
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
    expect(comparison.averagePoints).toBe(163 / 7);
    expect(comparison.scoreHistogram[10]).toBe(2);
    expect(comparison.scoreHistogram[20]).toBe(4);
    expect(comparison.scoreHistogram[63]).toBe(1);
    expect(comparison.sourceReadAt).toBe('2026-09-19T05:05:00Z');
  });

  it('implements strict-lower finishers semantics and excludes ties from the numerator', async () => {
    const service = createDailyNineComparisonService(repository(
      undefined,
      {
        sourceReadAt: '2026-09-19T05:06:00Z',
        scoreBuckets: [
          { points: 10, count: 2 },
          { points: 20, count: 3 },
          { points: 30, count: 1 },
        ],
      },
    ));
    const comparison = await service.getCompletedGames(KEY);

    expect(getDailyNineStrictLowerFinishersRate(comparison, 20)).toBe(2 / 6);
    expect(getDailyNineStrictLowerFinishersRate(comparison, 10)).toBe(0);
    expect(getDailyNineStrictLowerFinishersRate(comparison, 31)).toBe(1);
  });

  it('returns null strict-lower rate for an empty completed population', async () => {
    const comparison = await createDailyNineComparisonService(repository()).getCompletedGames(KEY);
    expect(getDailyNineStrictLowerFinishersRate(comparison, 40)).toBeNull();
  });

  it('keeps at-bat and completed-game reads separate', async () => {
    const repo = repository(
      { sourceReadAt: '2026-09-19T05:07:00Z', resolvedAtBatCount: 8, awardedPointsSum: 32 },
      { sourceReadAt: '2026-09-19T05:07:01Z', scoreBuckets: [{ points: 40, count: 2 }] },
    );
    const service = createDailyNineComparisonService(repo);

    await service.getAtBat({ ...KEY, pitchNumber: 5 });
    expect(repo.readCompletedGames).not.toHaveBeenCalled();

    await service.getCompletedGames(KEY);
    expect(repo.readAtBat).toHaveBeenCalledTimes(1);
    expect(repo.readCompletedGames).toHaveBeenCalledExactlyOnceWith(KEY);
  });

  it('rejects invalid score buckets and missing freshness metadata', async () => {
    const invalidScore = createDailyNineComparisonService(repository(
      undefined,
      { sourceReadAt: '2026-09-19T05:08:00Z', scoreBuckets: [{ points: 64, count: 1 }] },
    ));
    await expect(invalidScore.getCompletedGames(KEY)).rejects.toThrow('between 0 and 63');

    const missingFreshness = createDailyNineComparisonService(repository(
      { sourceReadAt: '', resolvedAtBatCount: 1, awardedPointsSum: 3 },
    ));
    await expect(missingFreshness.getAtBat({ ...KEY, pitchNumber: 1 }))
      .rejects.toThrow('sourceReadAt');
  });
});
