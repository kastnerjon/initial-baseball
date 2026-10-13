import { describe, expect, it } from 'vitest';
import { DAILY_AT_BAT_COUNT } from './dailyConstants';
import {
  CUSTOM_LINEUP_MAX_AT_BATS,
  CUSTOM_LINEUP_MIN_AT_BATS,
  DAILY_FIVE_AT_BAT_COUNT,
  isValidLineupLength,
  type LineupLengthPolicy,
} from './lineupLengthPolicy';
import { createCustomNineLineupSelection } from './customNineLineup';

describe('portable lineup length policies', () => {
  it('keeps legacy nine-player policies distinct from future five-player Daily', () => {
    expect(DAILY_AT_BAT_COUNT).toBe(9);
    expect(DAILY_FIVE_AT_BAT_COUNT).toBe(5);
    for (const profile of ['legacy-daily-nine', 'classic-inning', 'custom-nine-v1'] as const) {
      expect(isValidLineupLength(profile, 9)).toBe(true);
      for (const count of [0, 1, 5, 8, 10, 11]) {
        expect(isValidLineupLength(profile, count)).toBe(false);
      }
    }
    expect(isValidLineupLength('future-daily-five', 5)).toBe(true);
    for (const count of [0, 1, 4, 6, 9, 10, 11]) {
      expect(isValidLineupLength('future-daily-five', count)).toBe(false);
    }
  });

  it('allows future Custom selection of one through ten, without a five-player minimum', () => {
    expect(CUSTOM_LINEUP_MIN_AT_BATS).toBe(1);
    expect(CUSTOM_LINEUP_MAX_AT_BATS).toBe(10);
    for (let count = 1; count <= 10; count += 1) {
      expect(isValidLineupLength('future-custom-lineup', count)).toBe(true);
    }
    for (const count of [0, -1, 11, 20]) {
      expect(isValidLineupLength('future-custom-lineup', count)).toBe(false);
    }
  });

  it('rejects fractions, nonfinite values and unsafe counts for every profile', () => {
    const profiles: LineupLengthPolicy[] = [
      'legacy-daily-nine', 'classic-inning', 'custom-nine-v1',
      'future-daily-five', 'future-custom-lineup',
    ];
    for (const profile of profiles) {
      for (const count of [0.5, 5.5, 9.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        expect(isValidLineupLength(profile, count)).toBe(false);
      }
    }
  });

  it('preserves exact-nine Custom v1 issuance despite the future Custom profile', () => {
    const ids = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);
    expect(createCustomNineLineupSelection(ids).canonicalPlayerIds).toEqual(ids);
    for (const count of [1, 5, 10]) {
      const chosen = Array.from({ length: count }, (_, index) => `player-${index + 1}`);
      expect(isValidLineupLength('future-custom-lineup', chosen.length)).toBe(true);
      expect(() => createCustomNineLineupSelection(chosen)).toThrow('exactly nine');
    }
  });
});
