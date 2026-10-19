import { test } from 'node:test';
import { deepStrictEqual } from 'node:assert/strict';
import { deriveRegularSeasonPeaks } from './canonical-career-peaks.mjs';

test('picks highest regular-season totals with deterministic earliest-year ties', () => {
  deepStrictEqual(deriveRegularSeasonPeaks([
    { season: 2003, batting: { homeRuns: 35 }, pitching: { strikeouts: 180 } },
    { season: 2001, batting: { homeRuns: 35 }, pitching: { strikeouts: 210 } },
    { season: 2002, batting: { homeRuns: 31 }, pitching: { strikeouts: 210 } },
  ]), { homeRuns: { season: 2001, value: 35 }, strikeouts: { season: 2001, value: 210 } });
});

test('preserves known zero and null when season statistic is unsupported', () => {
  deepStrictEqual(deriveRegularSeasonPeaks([{ season: 1912, batting: { homeRuns: 0 }, pitching: null }]), {
    homeRuns: { season: 1912, value: 0 }, strikeouts: null,
  });
  deepStrictEqual(deriveRegularSeasonPeaks([{ season: 1940, batting: { homeRuns: null }, pitching: { strikeouts: null } }]), {
    homeRuns: null, strikeouts: null,
  });
});

test('skips malformed source counts and never sums across multiple seasons', () => {
  deepStrictEqual(deriveRegularSeasonPeaks([
    { season: 2000, batting: { homeRuns: -1 }, pitching: { strikeouts: 21.5 } },
    { season: 2001, batting: { homeRuns: 18 }, pitching: { strikeouts: 150 } },
    { season: 2002, batting: { homeRuns: 25 }, pitching: { strikeouts: 140 } },
  ]), { homeRuns: { season: 2002, value: 25 }, strikeouts: { season: 2001, value: 150 } });
});

test('handles empty and appearance-only histories without inventing zeros', () => {
  deepStrictEqual(deriveRegularSeasonPeaks([]), { homeRuns: null, strikeouts: null });
  deepStrictEqual(deriveRegularSeasonPeaks([{ season: 1890, positions: { gamesCatcher: 40 } }]), {
    homeRuns: null, strikeouts: null,
  });
});
