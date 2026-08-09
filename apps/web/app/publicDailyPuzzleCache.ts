import type {
  DailyPuzzleEditorialRecord,
  DailyPuzzleRepository,
} from '@initial-baseball/daily';
import { revalidateTag, unstable_cache } from 'next/cache';

const PUBLIC_DAILY_PUZZLE_CACHE_TAG = 'public-daily-editorial-puzzles-v1';
const PUBLIC_DAILY_PUZZLE_REVALIDATE_SECONDS = 300;

export type PublicDailyPuzzleReader = Pick<DailyPuzzleRepository, 'getByDate'>;

export function createCachedPublicDailyPuzzleReader(
  repository: PublicDailyPuzzleReader,
): PublicDailyPuzzleReader {
  const getByDate = unstable_cache(
    (puzzleDate: string): Promise<DailyPuzzleEditorialRecord | null> => repository.getByDate(puzzleDate),
    ['public-daily-editorial-puzzles-v1'],
    {
      revalidate: PUBLIC_DAILY_PUZZLE_REVALIDATE_SECONDS,
      tags: [PUBLIC_DAILY_PUZZLE_CACHE_TAG],
    },
  );

  return { getByDate };
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
