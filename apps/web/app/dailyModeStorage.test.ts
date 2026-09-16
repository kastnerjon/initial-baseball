import {
  CLASSIC_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  POINTS_V2_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  getDailyModeStorage,
  getDailyModeStorageKey,
  isDailyModeSaveCompatible,
} from './dailyModeStorage';

describe('dailyModeStorage', () => {
  it('preserves the existing Daily Nine key and gives Classic an isolated namespace', () => {
    expect(getDailyModeStorageKey('2026-09-18', POINTS_V3_DAILY_RULESET_VERSION))
      .toBe('initial-baseball:daily:2026-09-18');
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

  it('keeps old default-key rulesets compatible while isolating Classic saves', () => {
    for (const rulesetVersion of [
      LEGACY_DAILY_RULESET_VERSION,
      POINTS_V1_DAILY_RULESET_VERSION,
      POINTS_V2_DAILY_RULESET_VERSION,
      POINTS_V3_DAILY_RULESET_VERSION,
    ]) {
      expect(isDailyModeSaveCompatible(POINTS_V3_DAILY_RULESET_VERSION, rulesetVersion)).toBe(true);
      expect(isDailyModeSaveCompatible(CLASSIC_DAILY_RULESET_VERSION, rulesetVersion)).toBe(false);
    }

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
