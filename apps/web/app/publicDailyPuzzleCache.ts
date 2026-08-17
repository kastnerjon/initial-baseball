import type { DailyPuzzleRepository } from '@initial-baseball/daily';
import type { DailyPuzzle } from '@initial-baseball/shared';
import { revalidateTag, unstable_cache } from 'next/cache';

const PUBLIC_DAILY_PUZZLE_CACHE_TAG = 'public-daily-materialized-puzzles-v2';
const PUBLIC_DAILY_PUZZLE_REVALIDATE_SECONDS = 300;

export type PublicDailyPuzzleSource = (puzzleDate: string) => Promise<DailyPuzzle>;

export function createCachedPublicDailyPuzzleSource(
  source: PublicDailyPuzzleSource,
): PublicDailyPuzzleSource {
  const getByDate = unstable_cache(
    (puzzleDate: string): Promise<DailyPuzzle> => source(puzzleDate),
    ['public-daily-materialized-puzzles-v2'],
    {
      revalidate: PUBLIC_DAILY_PUZZLE_REVALIDATE_SECONDS,
      tags: [PUBLIC_DAILY_PUZZLE_CACHE_TAG],
    },
  );

  return puzzleDate => getByDate(puzzleDate);
}

export function createPublicDailyPuzzleCacheInvalidatingRepository(
  repository: DailyPuzzleRepository,
): DailyPuzzleRepository {
  return {
    getByDate: puzzleDate => repository.getByDate(puzzleDate),
    listByDateRange: (startDate, endDate) => repository.listByDateRange(startDate, endDate),
    async save(record, options) {
      const saved = await repository.save(record, options);
      revalidateTag(PUBLIC_DAILY_PUZZLE_CACHE_TAG);
      return saved;
    },
  };
}
