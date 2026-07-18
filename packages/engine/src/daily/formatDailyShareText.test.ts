import { expect, it } from 'vitest';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_SCORE_SUMMARY,
  type DailyGameState,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { applyDailyOutcomeToInning } from './applyDailyOutcomeToInning.js';
import { createDailyShareResult } from './createDailyShareResult.js';
import { formatDailyShareText } from './formatDailyShareText.js';

it('formats spoiler-safe daily share text with initials and outcomes', () => {
  expect(formatDailyShareText({
    puzzleNumber: 42,
    summary: {
      runs: 4,
      hits: 5,
      outs: 3,
      strikeouts: 1,
      completed: true,
    },
    url: 'https://dailyinning.com',
    pitchLines: [
      { initials: 'KGJ', outcome: 'HR' },
      { initials: 'PM', outcome: '2B' },
      { initials: 'CR', outcome: 'BB' },
      { initials: 'DW', outcome: 'K' },
    ],
  })).toBe([
    'Daily Inning #42',
    'by Initial Baseball',
    '',
    '4 R / 5 H / 3 OUT',
    '',
    'KGJ: HR',
    'PM: 2B',
    'CR: BB',
    'DW: K',
    '',
    'https://dailyinning.com',
  ].join('\n'));
});

it('formats stable share text from a full inning engine-driven share result', () => {
  const puzzle: DailyPuzzle = {
    id: 'puzzle-42',
    puzzleNumber: 42,
    puzzleDate: '2026-04-27',
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: {
      hitter: ['bwar', 'hr'],
      pitcher: ['bwar', 'era'],
    },
    pitches: [
      {
        pitchNumber: 1,
        player: {
          playerId: 'kgj',
          fullName: 'Ken Griffey Jr.',
          displayName: 'Ken Griffey Jr.',
          initials: 'KGJ',
          kind: 'hitter',
          primaryPosition: 'CF',
        },
        hints: {},
      },
      {
        pitchNumber: 2,
        player: {
          playerId: 'dw',
          fullName: 'David Wright',
          displayName: 'David Wright',
          initials: 'DW',
          kind: 'hitter',
          primaryPosition: '3B',
        },
        hints: {},
      },
      {
        pitchNumber: 3,
        player: {
          playerId: 'ccs',
          fullName: 'CC Sabathia',
          displayName: 'CC Sabathia',
          initials: 'CCS',
          kind: 'pitcher',
          primaryPosition: 'SP',
        },
        hints: {},
      },
    ],
  };

  let gameState: DailyGameState = {
    anonymousPlayerId: 'anon-1',
    status: 'in_progress',
    puzzle,
    inning: {
      inningNumber: 1,
      outs: 0,
      maxOuts: 3,
      bases: { first: false, second: false, third: false },
      completedAtBats: [],
      currentAtBat: null,
    },
    score: DEFAULT_DAILY_SCORE_SUMMARY,
    completedPitchLines: [],
    shareResult: null,
  };

  gameState = applyOutcome(gameState, 'HR', 'KGJ');
  gameState = applyOutcome(gameState, '2B', 'DW');
  gameState = applyOutcome(gameState, 'K', 'CCS');

  const shareText = formatDailyShareText(createDailyShareResult({
    gameState: {
      ...gameState,
      status: 'completed',
      score: {
        ...gameState.score,
        completed: true,
      },
    },
    url: 'https://dailyinning.com',
  }));

  expect(shareText).toBe([
    'Daily Inning #42',
    'by Initial Baseball',
    '',
    '1 R / 2 H / 1 OUT',
    '',
    'KGJ: HR',
    'DW: 2B',
    'CCS: K',
    '',
    'https://dailyinning.com',
  ].join('\n'));

  expect(shareText).not.toContain('Ken Griffey Jr.');
  expect(shareText).not.toContain('David Wright');
  expect(shareText).not.toContain('CC Sabathia');
});

function applyOutcome(gameState: DailyGameState, outcome: 'HR' | '2B' | 'K', initials: string): DailyGameState {
  const nextState = applyDailyOutcomeToInning({
    inning: gameState.inning,
    score: gameState.score,
    outcome,
  });

  return {
    ...gameState,
    inning: nextState.inning,
    score: nextState.score,
    completedPitchLines: [
      ...gameState.completedPitchLines,
      { initials, outcome },
    ],
  };
}
