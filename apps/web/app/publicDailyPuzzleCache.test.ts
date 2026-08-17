import type {
  DailyPuzzleEditorialRecord,
  DailyPuzzleRepository,
} from '@initial-baseball/daily';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cacheTestState = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  revalidateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (fetchData: (...args: unknown[]) => Promise<unknown>) => (
    async (...args: unknown[]) => {
      const key = JSON.stringify(args);
      if (cacheTestState.entries.has(key)) {
        return cacheTestState.entries.get(key);
      }
      const value = await fetchData(...args);
      cacheTestState.entries.set(key, value);
      return value;
    }
  ),
  revalidateTag: (tag: string) => {
    cacheTestState.revalidateTag(tag);
    cacheTestState.entries.clear();
  },
}));

import {
  createCachedPublicDailyPuzzleSource,
  createPublicDailyPuzzleCacheInvalidatingRepository,
} from './publicDailyPuzzleCache';

describe('public Daily puzzle cache', () => {
  beforeEach(() => {
    cacheTestState.entries.clear();
    cacheTestState.revalidateTag.mockClear();
  });

  it('reuses a fully materialized public puzzle for the same date', async () => {
    const source = vi.fn(async (puzzleDate: string) => createPuzzle(puzzleDate, 5));
    const cachedSource = createCachedPublicDailyPuzzleSource(source);

    await expect(cachedSource('2026-08-09')).resolves.toMatchObject({ puzzleNumber: 105 });
    await expect(cachedSource('2026-08-09')).resolves.toMatchObject({ puzzleNumber: 105 });

    expect(source).toHaveBeenCalledTimes(1);
  });

  it('invalidates a cached materialized puzzle after a successful editorial save', async () => {
    let current = createRecord(0);
    const repository = createRepository(current, saved => {
      current = saved;
    }, () => current);
    const source = vi.fn(async (puzzleDate: string) => createPuzzle(puzzleDate, current.revision));
    const cachedSource = createCachedPublicDailyPuzzleSource(source);
    const invalidatingRepository = createPublicDailyPuzzleCacheInvalidatingRepository(repository);

    await expect(cachedSource(current.puzzleDate)).resolves.toMatchObject({ puzzleNumber: 100 });
    const updated = { ...current, revision: 1, status: 'archived' as const };
    await invalidatingRepository.save(updated, { expectedRevision: 0 });
    await expect(cachedSource(current.puzzleDate)).resolves.toMatchObject({ puzzleNumber: 101 });

    expect(source).toHaveBeenCalledTimes(2);
    expect(cacheTestState.revalidateTag).toHaveBeenCalledTimes(1);
  });

  it('does not invalidate a materialized puzzle when an editorial save fails', async () => {
    const record = createRecord(0);
    const repository = createRepository(record);
    repository.save = vi.fn(async () => {
      throw new Error('save failed');
    });
    const invalidatingRepository = createPublicDailyPuzzleCacheInvalidatingRepository(repository);

    await expect(invalidatingRepository.save(record, { expectedRevision: 0 })).rejects.toThrow('save failed');
    expect(cacheTestState.revalidateTag).not.toHaveBeenCalled();
  });
});

function createPuzzle(puzzleDate: string, revision: number): DailyPuzzle {
  return {
    id: `daily-${puzzleDate}`,
    puzzleDate,
    puzzleNumber: 100 + revision,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: [],
  };
}

function createRepository(
  initial: DailyPuzzleEditorialRecord,
  onSave: (record: DailyPuzzleEditorialRecord) => void = () => undefined,
  readCurrent: () => DailyPuzzleEditorialRecord = () => initial,
): DailyPuzzleRepository {
  return {
    getByDate: vi.fn(async () => readCurrent()),
    listByDateRange: vi.fn(async () => [readCurrent()]),
    save: vi.fn(async (record) => {
      onSave(record);
      return record;
    }),
  };
}

function createRecord(revision: number): DailyPuzzleEditorialRecord {
  return {
    id: 'editorial-2026-08-09',
    puzzleDate: '2026-08-09',
    puzzleNumber: 105,
    version: 1,
    revision,
    status: 'published',
    selections: [],
    createdAt: '2026-08-01T12:00:00.000Z',
    createdBy: 'editor',
    updatedAt: '2026-08-01T12:00:00.000Z',
    updatedBy: 'editor',
    scheduledAt: '2026-08-01T12:00:00.000Z',
    scheduledBy: 'editor',
    publishedAt: '2026-08-01T12:00:00.000Z',
    publishedBy: 'editor',
    archivedAt: null,
    archivedBy: null,
  };
}
