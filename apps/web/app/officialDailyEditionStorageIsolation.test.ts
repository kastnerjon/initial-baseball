import { describe, expect, it } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import { clearSavedDailyGame, hasPersistedDailyGameValue } from './dailyLocalStorage';
import { getDailyModeStorage, getDailyModeStorageKey, isDailyModeSaveCompatible } from './dailyModeStorage';
import {
  getDailyGameplayPersistenceSessionKey,
  isDailyResultCollectionEnabled,
} from './dailyGameplayPersistenceAuthority';
import { DEMO_DAILY_PUZZLE } from './mockDailyPuzzle';

const DATE = '2026-11-06';
const EDITION_A = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const EDITION_B = 'daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648';
const PRIMARY = 'daily-2026-11-06-editorial-03e21d89';
const ARCHIVE_BETA = 'archive-beta-v1-daily-34';
const DAILY_KEY = `initial-baseball:daily:${DATE}`;

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('same-date secondary official Daily browser persistence boundary', () => {
  it('keeps two identical-roster editions, primary, Classic and Archive beta in distinct namespaces', () => {
    const storage = new MemoryStorage();
    const variants = [
      [EDITION_A, POINTS_V4_DAILY_RULESET_VERSION],
      [EDITION_B, POINTS_V4_DAILY_RULESET_VERSION],
      [PRIMARY, POINTS_V4_DAILY_RULESET_VERSION],
      [undefined, CLASSIC_DAILY_RULESET_VERSION],
      [ARCHIVE_BETA, POINTS_V4_DAILY_RULESET_VERSION],
    ] as const;
    const scoped = variants.map(([id, ruleset], index) => {
      const adapter = getDailyModeStorage(ruleset, storage, id)!;
      adapter.setItem(DAILY_KEY, `progression-${index}`);
      return adapter;
    });
    expect(new Set(variants.map(([id, ruleset]) =>
      getDailyModeStorageKey(DATE, ruleset, id))).size).toBe(variants.length);
    expect(scoped.map(adapter => adapter.getItem(DAILY_KEY))).toEqual([
      'progression-0', 'progression-1', 'progression-2', 'progression-3', 'progression-4',
    ]);
    expect(getDailyModeStorageKey(DATE, POINTS_V4_DAILY_RULESET_VERSION, EDITION_A))
      .toContain(EDITION_A);
    expect(storage.getItem(DAILY_KEY)).toBeNull();
  });

  it('resumes the exact saved edition and never clears a different same-date edition', () => {
    const storage = new MemoryStorage();
    const first = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, EDITION_A)!;
    const second = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, EDITION_B)!;
    first.setItem(DAILY_KEY, 'a-partial-hints');
    second.setItem(DAILY_KEY, 'b-already-complete');
    const reopenedFirst = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, EDITION_A)!;
    expect(reopenedFirst.getItem(DAILY_KEY)).toBe('a-partial-hints');
    expect(hasPersistedDailyGameValue(DATE, reopenedFirst)).toBe(true);
    expect(clearSavedDailyGame({ ...DEMO_DAILY_PUZZLE, id: EDITION_A, puzzleDate: DATE }, reopenedFirst))
      .toBe(true);
    expect(first.getItem(DAILY_KEY)).toBeNull();
    expect(hasPersistedDailyGameValue(DATE, reopenedFirst)).toBe(false);
    expect(second.getItem(DAILY_KEY)).toBe('b-already-complete');
    expect(hasPersistedDailyGameValue(DATE, second)).toBe(true);
  });

  it('never reads, migrates or deletes a legacy date-only or unscoped v4 primary save', () => {
    const storage = new MemoryStorage();
    const unscopedV4 = `initial-baseball:daily:ruleset:points-v4:${DATE}`;
    storage.setItem(DAILY_KEY, 'legacy-primary-daily');
    storage.setItem(unscopedV4, 'unscoped-primary-v4');
    const edition = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, EDITION_A)!;
    expect(edition.getItem(DAILY_KEY)).toBeNull();
    expect(hasPersistedDailyGameValue(DATE, edition)).toBe(false);
    edition.setItem(DAILY_KEY, 'new-edition');
    edition.removeItem(DAILY_KEY);
    expect(storage.getItem(DAILY_KEY)).toBe('legacy-primary-daily');
    expect(storage.getItem(unscopedV4)).toBe('unscoped-primary-v4');
    expect(edition.getItem(DAILY_KEY)).toBeNull();
  });

  it('fences the same edition by ruleset and separately scopes its ownership session', () => {
    const storage = new MemoryStorage();
    const points = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, EDITION_A)!;
    const classic = getDailyModeStorage(CLASSIC_DAILY_RULESET_VERSION, storage, EDITION_A)!;
    points.setItem(DAILY_KEY, 'points-progress');
    classic.setItem(DAILY_KEY, 'classic-progress');
    expect(points.getItem(DAILY_KEY)).toBe('points-progress');
    expect(classic.getItem(DAILY_KEY)).toBe('classic-progress');
    expect(isDailyModeSaveCompatible(
      POINTS_V4_DAILY_RULESET_VERSION, CLASSIC_DAILY_RULESET_VERSION, EDITION_A,
    )).toBe(false);
    const aKey = getDailyGameplayPersistenceSessionKey(
      { id: EDITION_A, puzzleDate: DATE, puzzleNumber: 194 }, POINTS_V4_DAILY_RULESET_VERSION,
    );
    const bKey = getDailyGameplayPersistenceSessionKey(
      { id: EDITION_B, puzzleDate: DATE, puzzleNumber: 194 }, POINTS_V4_DAILY_RULESET_VERSION,
    );
    expect(aKey).not.toBe(bKey);
  });

  it('keeps every reserved secondary version noncompetitive while primary and beta admission remain unchanged', () => {
    for (const id of [EDITION_A, EDITION_B, 'daily-ed-v2-unknown-future-version',
      'daily-ed-not-verified']) {
      expect(isDailyResultCollectionEnabled(id)).toBe(false);
    }
    expect(isDailyResultCollectionEnabled(PRIMARY)).toBe(true);
    expect(isDailyResultCollectionEnabled(ARCHIVE_BETA)).toBe(true);
  });
});
