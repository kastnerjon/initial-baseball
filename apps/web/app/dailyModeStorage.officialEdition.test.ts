import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  getDailyModeStorage,
  getDailyModeStorageKey,
  isDailyModeSaveCompatible,
} from './dailyModeStorage';
import { hasPersistedDailyGameValue } from './dailyLocalStorage';

const DATE = '2026-11-06';
const FIRST = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const SECOND = 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591';
const PRIMARY = 'daily-2026-11-06-editorial-abcd1234';
const GAME_KEY = 'initial-baseball:daily:' + DATE;
const LEGACY_V4_KEY = 'initial-baseball:daily:ruleset:points-v4:' + DATE;

/** In-memory browser storage for cross-edition persistence isolation tests. */
class TestStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('secondary official Daily edition browser-save isolation', () => {
  it('uses a distinct physical key per puzzle and ruleset, even on the same date', () => {
    const storage = new TestStorage();
    const first = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, FIRST)!;
    const second = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, SECOND)!;
    const primary = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, PRIMARY)!;

    first.setItem(GAME_KEY, JSON.stringify({ puzzleId: FIRST, score: 1 }));
    second.setItem(GAME_KEY, JSON.stringify({ puzzleId: SECOND, score: 2 }));
    primary.setItem(GAME_KEY, JSON.stringify({ puzzleId: PRIMARY, score: 3 }));
    const keys = [
      getDailyModeStorageKey(DATE, POINTS_V4_DAILY_RULESET_VERSION, FIRST),
      getDailyModeStorageKey(DATE, POINTS_V4_DAILY_RULESET_VERSION, SECOND),
      getDailyModeStorageKey(DATE, POINTS_V4_DAILY_RULESET_VERSION, PRIMARY),
      getDailyModeStorageKey(DATE, CLASSIC_DAILY_RULESET_VERSION, FIRST),
      getDailyModeStorageKey(DATE, POINTS_V3_DAILY_RULESET_VERSION, FIRST),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toContain('initial-baseball:daily:edition-v1:');
    expect(JSON.parse(first.getItem(GAME_KEY)!)).toMatchObject({ puzzleId: FIRST, score: 1 });
    expect(JSON.parse(second.getItem(GAME_KEY)!)).toMatchObject({ puzzleId: SECOND, score: 2 });
    expect(JSON.parse(primary.getItem(GAME_KEY)!)).toMatchObject({ puzzleId: PRIMARY, score: 3 });

    first.removeItem(GAME_KEY);
    expect(first.getItem(GAME_KEY)).toBeNull();
    expect(second.getItem(GAME_KEY)).not.toBeNull();
    expect(primary.getItem(GAME_KEY)).not.toBeNull();
  });

  it('never adopts or deletes unscoped same-date legacy state, even when unreadable', () => {
    const storage = new TestStorage();
    const first = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, FIRST)!;
    const second = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, SECOND)!;
    storage.setItem(LEGACY_V4_KEY, '{broken');
    storage.setItem(GAME_KEY, 'legacy-points-v3-save');
    expect(first.getItem(GAME_KEY)).toBeNull();
    expect(second.getItem(GAME_KEY)).toBeNull();
    expect(hasPersistedDailyGameValue(DATE, first)).toBe(false);

    first.setItem(GAME_KEY, JSON.stringify({ puzzleId: FIRST }));
    first.removeItem(GAME_KEY);
    expect(storage.getItem(LEGACY_V4_KEY)).toBe('{broken');
    expect(storage.getItem(GAME_KEY)).toBe('legacy-points-v3-save');

    storage.setItem(LEGACY_V4_KEY, JSON.stringify({ puzzleId: PRIMARY }));
    second.removeItem(GAME_KEY);
    expect(storage.getItem(LEGACY_V4_KEY)).toBe(JSON.stringify({ puzzleId: PRIMARY }));
    expect(first.getItem(GAME_KEY)).toBeNull();
  });

  it('keeps earlier historical rulesets and Classic separate for the new edition ID', () => {
    const storage = new TestStorage();
    const v3 = getDailyModeStorage(POINTS_V3_DAILY_RULESET_VERSION, storage, FIRST)!;
    const v4 = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, FIRST)!;
    const classic = getDailyModeStorage(CLASSIC_DAILY_RULESET_VERSION, storage, FIRST)!;

    v3.setItem(GAME_KEY, 'v3');
    v4.setItem(GAME_KEY, 'v4');
    classic.setItem(GAME_KEY, 'classic');
    expect(v3.getItem(GAME_KEY)).toBe('v3');
    expect(v4.getItem(GAME_KEY)).toBe('v4');
    expect(classic.getItem(GAME_KEY)).toBe('classic');
    expect(isDailyModeSaveCompatible(POINTS_V3_DAILY_RULESET_VERSION,
      POINTS_V3_DAILY_RULESET_VERSION, FIRST)).toBe(true);
    expect(isDailyModeSaveCompatible(POINTS_V3_DAILY_RULESET_VERSION,
      POINTS_V4_DAILY_RULESET_VERSION, FIRST)).toBe(false);
    expect(isDailyModeSaveCompatible(POINTS_V3_DAILY_RULESET_VERSION,
      'legacy-inning-v1', FIRST)).toBe(false);
    expect(isDailyModeSaveCompatible(POINTS_V4_DAILY_RULESET_VERSION,
      POINTS_V4_DAILY_RULESET_VERSION, FIRST)).toBe(true);
  });

  it('passes already identity-scoped attempt and completed-result bookkeeping through unchanged', () => {
    const storage = new TestStorage();
    const adapter = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage, FIRST)!;
    for (const key of [
      'initial-baseball:daily-at-bat-attempt:v1:points-v4:' + DATE + ':' + FIRST,
      'initial-baseball:daily-result-submission:v1:points-v4:' + DATE + ':' + FIRST,
    ]) {
      adapter.setItem(key, 'id-scoped-record');
      expect(adapter.getItem(key)).toBe('id-scoped-record');
      expect(storage.getItem(key)).toBe('id-scoped-record');
      adapter.removeItem(key);
      expect(storage.getItem(key)).toBeNull();
    }
  });
});
