import { expect, it } from 'vitest';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_SCORE_SUMMARY,
  type DailyGameState,
  type DailyOutcome,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import { applyDailyOutcomeToInning } from './applyDailyOutcomeToInning.js';
import { createDailyShareResult } from './createDailyShareResult.js';

const puzzle: DailyPublicPuzzle = {
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
      initials: 'KGJ',
    },
    {
      pitchNumber: 2,
      initials: 'DW',
    },
    {
      pitchNumber: 3,
      initials: 'CCS',
    },
  ],
};

it('builds a spoiler-safe share result from real engine state', () => {
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

  const result = createDailyShareResult({
    gameState: {
      ...gameState,
      status: 'completed',
      score: {
        ...gameState.score,
        completed: true,
      },
    },
    url: 'https://dailyinning.com',
  });

  expect(result).toEqual({
    puzzleNumber: 42,
    summary: {
      runs: 1,
      hits: 2,
      outs: 1,
      strikeouts: 1,
      completed: true,
    },
    pitchLines: [
      { initials: 'KGJ', outcome: 'HR' },
      { initials: 'DW', outcome: '2B' },
      { initials: 'CCS', outcome: 'K' },
    ],
    url: 'https://dailyinning.com',
  });

  expect(JSON.stringify(result)).not.toContain('Ken Griffey Jr.');
  expect(JSON.stringify(result)).not.toContain('David Wright');
  expect(JSON.stringify(result)).not.toContain('CC Sabathia');
});

function applyOutcome(gameState: DailyGameState, outcome: DailyOutcome, initials: string): DailyGameState {
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
