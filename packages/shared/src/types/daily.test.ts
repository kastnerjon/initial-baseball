import { expect, it } from 'vitest';
import {
  DEFAULT_DAILY_BASE_STATE,
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_HINT_TYPES,
  DEFAULT_DAILY_SCORING,
  DEFAULT_DAILY_SCORE_SUMMARY,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  CURRENT_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  isDailyPointsRulesetVersion,
  isDailyRulesetVersion,
} from './daily.js';

it('keeps the default daily hint ladder in the expected order', () => {
  expect(DEFAULT_DAILY_HINT_CONFIG.map((slot) => slot.hintType)).toEqual(DEFAULT_DAILY_HINT_TYPES);
  expect(DEFAULT_DAILY_HINT_CONFIG.map((slot) => slot.result)).toEqual(['triple', 'double', 'single', 'walk']);
  expect(DEFAULT_DAILY_HINT_CONFIG.map((slot) => slot.displayLabel)).toEqual([
    'Main decade played in',
    'Teams',
    'Position',
    'Stats',
  ]);
});

it('maps daily scoring points to the expected outcomes', () => {
  expect(DEFAULT_DAILY_SCORING).toEqual({
    initials: 'HR',
    1: '3B',
    2: '2B',
    3: '1B',
    4: 'BB',
    strikeout: 'K',
  });
});

it('uses only the supported compact stat subsets for daily stats hints', () => {
  expect(DEFAULT_DAILY_STATS_HINT_CONFIG.hitter).toEqual(['hr', 'rbi', 'sb', 'ba', 'obp']);
  expect(DEFAULT_DAILY_STATS_HINT_CONFIG.pitcher).toEqual(['w', 'l', 'sv', 'era', 'whip', 'k']);
});

it('starts score and bases in an empty inning state', () => {
  expect(DEFAULT_DAILY_SCORE_SUMMARY).toEqual({
    runs: 0,
    hits: 0,
    outs: 0,
    strikeouts: 0,
    completed: false,
  });

  expect(DEFAULT_DAILY_BASE_STATE).toEqual({
    first: false,
    second: false,
    third: false,
  });
});

it('recognizes points-v4 without changing the current Daily Nine default', () => {
  expect(isDailyRulesetVersion(POINTS_V4_DAILY_RULESET_VERSION)).toBe(true);
  expect(isDailyPointsRulesetVersion(POINTS_V4_DAILY_RULESET_VERSION)).toBe(true);
  expect(CURRENT_DAILY_RULESET_VERSION).toBe(POINTS_V3_DAILY_RULESET_VERSION);
});
