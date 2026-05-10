import { expect, it } from 'vitest';
import {
  DEFAULT_DAILY_BASE_STATE,
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_HINT_TYPES,
  DEFAULT_DAILY_SCORING,
  DEFAULT_DAILY_SCORE_SUMMARY,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
} from './daily.js';

it('keeps the default daily hint ladder in the expected order', () => {
  expect(DEFAULT_DAILY_HINT_CONFIG.map((slot) => slot.hintType)).toEqual(DEFAULT_DAILY_HINT_TYPES);
  expect(DEFAULT_DAILY_HINT_CONFIG.map((slot) => slot.result)).toEqual(['triple', 'double', 'single', 'sac']);
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
    4: 'SAC',
    strikeout: 'K',
  });
});

it('uses the shared bWAR-first stat defaults for daily stats hints', () => {
  expect(DEFAULT_DAILY_STATS_HINT_CONFIG.hitter[0]).toBe('bwar');
  expect(DEFAULT_DAILY_STATS_HINT_CONFIG.pitcher[0]).toBe('bwar');
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
