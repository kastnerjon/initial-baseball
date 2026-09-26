import {
  CLASSIC_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  POINTS_V2_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  getDailyModeStorage,
  getDailyModeStorageKey,
  isDailyModeSaveCompatible,
} from './dailyModeStorage';

describe('dailyModeStorage', () => {
  it('preserves the historical points-v3 key while versioning points-v4 and isolating Classic', () => {
    expect(getDailyModeStorageKey('2026-09-18', POINTS_V3_DAILY_RULESET_VERSION))
      .toBe('initial-baseball:daily:2026-09-18');
    expect(getDailyModeStorageKey('2026-09-18', POINTS_V4_DAILY_RULESET_VERSION))
      .toBe('initial-baseball:daily:ruleset:points-v4:2026-09-18');
    expect(getDailyModeStorageKey('2026-09-18', CLASSIC_DAILY_RULESET_VERSION))
      .toBe('initial-baseball:daily:classic:2026-09-18');
  });

  it('translates only Daily keys for Classic without changing the underlying storage contract', () => {
    const storage = new FakeStorage();
    const classic = getDailyModeStorage(CLASSIC_DAILY_RULESET_VERSION, storage);
    if (classic === null) throw new Error('Expected Classic storage adapter.');

    classic.setItem('initial-baseball:daily:2026-09-18', 'classic-save');
    expect(storage.getItem('initial-baseball:daily:classic:2026-09-18')).toBe('classic-save');
    expect(storage.getItem('initial-baseball:daily:2026-09-18')).toBeNull();

    classic.removeItem('initial-baseball:daily:2026-09-18');
    expect(storage.getItem('initial-baseball:daily:classic:2026-09-18')).toBeNull();
  });

  it('leaves Daily Nine storage untouched', () => {
    const storage = new FakeStorage();
    const daily = getDailyModeStorage(POINTS_V3_DAILY_RULESET_VERSION, storage);
    if (daily === null) throw new Error('Expected Daily storage.');

    daily.setItem('initial-baseball:daily:2026-09-18', 'daily-save');
    expect(storage.getItem('initial-baseball:daily:2026-09-18')).toBe('daily-save');
    expect(storage.getItem('initial-baseball:daily:classic:2026-09-18')).toBeNull();
  });

  it('keeps a points-v4 current-Daily save physically isolated from the historical points-v3 key', () => {
    const storage = new FakeStorage();
    const key = 'initial-baseball:daily:2026-09-18';
    storage.setItem(key, 'points-v3-save');

    const v4 = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage);
    if (v4 === null) throw new Error('Expected points-v4 storage adapter.');

    v4.setItem(key, 'points-v4-save');

    expect(storage.getItem(key)).toBe('points-v3-save');
    expect(storage.getItem('initial-baseball:daily:ruleset:points-v4:2026-09-18'))
      .toBe('points-v4-save');
    expect(v4.getItem(key)).toBe('points-v4-save');

    v4.removeItem(key);
    expect(storage.getItem('initial-baseball:daily:ruleset:points-v4:2026-09-18')).toBeNull();
    expect(storage.getItem(key)).toBe('points-v3-save');
  });

  it('isolates each permanent puzzle and ruleset from current Daily and Classic saves', () => {
    const storage = new FakeStorage();
    const date = '2030-04-05';
    const dailyKey = `initial-baseball:daily:${date}`;
    const first = 'permanent-v1-daily-1';
    const second = 'permanent-v1-daily-2';
    const archivedPoints = getDailyModeStorage(POINTS_V3_DAILY_RULESET_VERSION, storage, first);
    const archivedOlderPoints = getDailyModeStorage(POINTS_V2_DAILY_RULESET_VERSION, storage, first);
    const archivedClassic = getDailyModeStorage(CLASSIC_DAILY_RULESET_VERSION, storage, first);
    const otherArchive = getDailyModeStorage(POINTS_V3_DAILY_RULESET_VERSION, storage, second);
    if (!archivedPoints || !archivedOlderPoints || !archivedClassic || !otherArchive) {
      throw new Error('Storage unavailable');
    }

    storage.setItem(dailyKey, 'current');
    getDailyModeStorage(CLASSIC_DAILY_RULESET_VERSION, storage)?.setItem(dailyKey, 'current-classic');
    archivedPoints.setItem(dailyKey, 'archive-points');
    archivedOlderPoints.setItem(dailyKey, 'archive-older-points');
    archivedClassic.setItem(dailyKey, 'archive-classic');
    otherArchive.setItem(dailyKey, 'other-archive');

    expect(storage.getItem(dailyKey)).toBe('current');
    expect(storage.getItem(`initial-baseball:daily:classic:${date}`)).toBe('current-classic');
    expect(archivedPoints.getItem(dailyKey)).toBe('archive-points');
    expect(archivedOlderPoints.getItem(dailyKey)).toBe('archive-older-points');
    expect(archivedClassic.getItem(dailyKey)).toBe('archive-classic');
    expect(archivedOlderPoints.getItem(dailyKey)).toBe('archive-older-points');
    expect(otherArchive.getItem(dailyKey)).toBe('other-archive');
    expect(getDailyModeStorageKey(date, POINTS_V3_DAILY_RULESET_VERSION, first))
      .toBe(`initial-baseball:archive:permanent-v1:${first}:points-v3:${date}`);
    expect(getDailyModeStorageKey(date, CLASSIC_DAILY_RULESET_VERSION, first))
      .not.toBe(getDailyModeStorageKey(date, POINTS_V3_DAILY_RULESET_VERSION, first));
    archivedPoints.removeItem(dailyKey);
    expect(archivedPoints.getItem(dailyKey)).toBeNull();
    expect(archivedClassic.getItem(dailyKey)).toBe('archive-classic');
    expect(otherArchive.getItem(dailyKey)).toBe('other-archive');
    expect(storage.getItem(dailyKey)).toBe('current');
  });

  it('leaves identity-keyed journal and outbox keys unchanged', () => {
    const storage = new FakeStorage();
    const archived = getDailyModeStorage(POINTS_V3_DAILY_RULESET_VERSION, storage, 'permanent-v1-daily-1');
    const currentV4 = getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, storage);
    if (!archived || !currentV4) throw new Error('Storage unavailable');

    const archiveKey = 'initial-baseball:daily-at-bat-attempt:v1:points-v3:2030-04-05:permanent-v1-daily-1';
    const currentV4Key = 'initial-baseball:daily-at-bat-attempt:v1:points-v4:2026-09-18:daily-2026-09-18-editorial-v1';
    archived.setItem(archiveKey, 'archive-journal');
    currentV4.setItem(currentV4Key, 'v4-journal');

    expect(storage.getItem(archiveKey)).toBe('archive-journal');
    expect(storage.getItem(currentV4Key)).toBe('v4-journal');
  });

  it('restores archive saves only with the exact scoring version', () => {
    expect(isDailyModeSaveCompatible(POINTS_V3_DAILY_RULESET_VERSION, POINTS_V2_DAILY_RULESET_VERSION,
      'permanent-v1-daily-1')).toBe(false);
    expect(isDailyModeSaveCompatible(POINTS_V3_DAILY_RULESET_VERSION, POINTS_V3_DAILY_RULESET_VERSION,
      'permanent-v1-daily-1')).toBe(true);
  });

  it('preserves the historical pre-v4 restore family under points-v3 but fences the v4 cutover', () => {
    for (const rulesetVersion of [
      LEGACY_DAILY_RULESET_VERSION,
      POINTS_V1_DAILY_RULESET_VERSION,
      POINTS_V2_DAILY_RULESET_VERSION,
      POINTS_V3_DAILY_RULESET_VERSION,
    ]) {
      expect(isDailyModeSaveCompatible(POINTS_V3_DAILY_RULESET_VERSION, rulesetVersion)).toBe(true);
      expect(isDailyModeSaveCompatible(POINTS_V4_DAILY_RULESET_VERSION, rulesetVersion)).toBe(false);
      expect(isDailyModeSaveCompatible(CLASSIC_DAILY_RULESET_VERSION, rulesetVersion)).toBe(false);
    }

    expect(isDailyModeSaveCompatible(POINTS_V4_DAILY_RULESET_VERSION, POINTS_V4_DAILY_RULESET_VERSION)).toBe(true);
    expect(isDailyModeSaveCompatible(POINTS_V3_DAILY_RULESET_VERSION, POINTS_V4_DAILY_RULESET_VERSION)).toBe(false);
    expect(isDailyModeSaveCompatible(CLASSIC_DAILY_RULESET_VERSION, CLASSIC_DAILY_RULESET_VERSION)).toBe(true);
    expect(isDailyModeSaveCompatible(POINTS_V3_DAILY_RULESET_VERSION, CLASSIC_DAILY_RULESET_VERSION)).toBe(false);
  });
});

class FakeStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}
