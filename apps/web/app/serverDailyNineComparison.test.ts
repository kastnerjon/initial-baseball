import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyPublicPuzzle } from '@initial-baseball/shared';

vi.mock('server-only', () => ({}));

const dependencies = vi.hoisted(() => {
  const repository = {
    readAtBat: vi.fn(),
    readCompletedGames: vi.fn(),
  };
  return {
    getPublicPuzzle: vi.fn(),
    repository,
    createRepository: vi.fn(() => repository),
    createServerSupabaseClient: vi.fn(() => ({})),
  };
});

vi.mock('./serverCanonicalRuntime', () => ({
  dailyRuntime: {
    getPublicPuzzle: dependencies.getPublicPuzzle,
  },
}));

vi.mock('./serverSupabaseClient', () => ({
  createServerSupabaseClient: dependencies.createServerSupabaseClient,
}));

vi.mock('./supabaseDailyNineComparisonRepository', () => ({
  createSupabaseDailyNineComparisonRepository: dependencies.createRepository,
}));

vi.mock('./getPacificDailyDateString', () => ({
  getPacificDailyDateString: () => '2026-09-22',
}));

import {
  readDailyNineAtBatComparison,
  readDailyNineCompletedComparison,
} from './serverDailyNineComparison';

const PUZZLE: DailyPublicPuzzle = {
  id: 'daily-2026-09-19-editorial-a9429f70',
  puzzleDate: '2026-09-19',
  puzzleNumber: 146,
  status: 'scheduled',
  hintConfig: [],
  statsHintConfig: { hitter: [], pitcher: [] },
  pitches: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1,
    initials: `P${index + 1}`,
  })),
};

describe('server Daily Nine comparison timing composition', () => {
  beforeEach(() => {
    dependencies.getPublicPuzzle.mockReset();
    dependencies.repository.readAtBat.mockReset();
    dependencies.repository.readCompletedGames.mockReset();
    dependencies.createRepository.mockClear();
    dependencies.createServerSupabaseClient.mockClear();
  });

  it('records puzzle and provider stages around an at-bat read', async () => {
    dependencies.getPublicPuzzle.mockResolvedValue(PUZZLE);
    dependencies.repository.readAtBat.mockResolvedValue({
      resolvedAtBatCount: 2,
      awardedPointsSum: 7,
    });
    const timings = {};

    const result = await readDailyNineAtBatComparison({
      puzzleDate: PUZZLE.puzzleDate,
      rulesetVersion: 'points-v3',
      pitchNumber: '4',
    }, timings);

    expect(result.comparison.averagePoints).toBe(3.5);
    expect(timings).toEqual({
      puzzle: expect.any(Number),
      provider: expect.any(Number),
      'provider-setup': expect.any(Number),
    });
    expect(dependencies.getPublicPuzzle).toHaveBeenCalledWith(PUZZLE.puzzleDate);
    expect(dependencies.repository.readAtBat).toHaveBeenCalledOnce();
    expect(dependencies.repository.readCompletedGames).not.toHaveBeenCalled();
  });

  it('records completed provider time even when the provider rejects', async () => {
    dependencies.getPublicPuzzle.mockResolvedValue(PUZZLE);
    const failure = new Error('provider unavailable');
    dependencies.repository.readCompletedGames.mockRejectedValue(failure);
    const timings = {};

    await expect(readDailyNineCompletedComparison({
      puzzleDate: PUZZLE.puzzleDate,
      rulesetVersion: 'points-v3',
    }, timings)).rejects.toBe(failure);

    expect(timings).toEqual({
      puzzle: expect.any(Number),
      provider: expect.any(Number),
      'provider-setup': expect.any(Number),
    });
  });

  it('records puzzle time without inventing provider time when puzzle loading fails', async () => {
    const failure = new Error('puzzle unavailable');
    dependencies.getPublicPuzzle.mockRejectedValue(failure);
    const timings = {};

    await expect(readDailyNineCompletedComparison({
      puzzleDate: PUZZLE.puzzleDate,
      rulesetVersion: 'points-v3',
    }, timings)).rejects.toBe(failure);

    expect(timings).toEqual({
      puzzle: expect.any(Number),
    });
    expect(dependencies.createRepository).not.toHaveBeenCalled();
  });
});
