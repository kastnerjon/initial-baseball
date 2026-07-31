import { expect, it } from 'vitest';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_SCORE_SUMMARY,
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  type DailyCompletedAtBat,
  type DailyGameState,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import { applyDailyOutcomeForRuleset, createDailyPointsSummary } from './applyDailyRuleset.js';
import { createDailyShareResult } from './createDailyShareResult.js';
import { formatDailyShareText } from './formatDailyShareText.js';

it('formats a compatible legacy result with baseball totals', () => {
  expect(formatDailyShareText({
    rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
    puzzleNumber: 42,
    summary: {
      runs: 4,
      hits: 5,
      outs: 3,
      strikeouts: 1,
      completed: true,
    },
    points: {
      points: 0,
      maximumPoints: 0,
      atBatsCompleted: 4,
      totalAtBats: 9,
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

it('formats stable spoiler-safe points-v1 share text from engine state', () => {
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
      { pitchNumber: 1, initials: 'KGJ' },
      { pitchNumber: 2, initials: 'DW' },
      { pitchNumber: 3, initials: 'CCS' },
    ],
  };

  let gameState: DailyGameState = {
    anonymousPlayerId: 'anon-1',
    status: 'in_progress',
    rulesetVersion: POINTS_V1_DAILY_RULESET_VERSION,
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
    points: createDailyPointsSummary(POINTS_V1_DAILY_RULESET_VERSION, puzzle.pitches.length),
    completedAtBats: [],
    completedPitchLines: [],
    shareResult: null,
  };

  gameState = applyOutcome(gameState, 'HR', 'KGJ', 1);
  gameState = applyOutcome(gameState, '2B', 'DW', 2);
  gameState = applyOutcome(gameState, 'K', 'CCS', 3);

  const shareText = formatDailyShareText(createDailyShareResult({
    gameState: {
      ...gameState,
      status: 'completed',
      score: { ...gameState.score, completed: true },
      points: { ...gameState.points, completed: true },
    },
    url: 'https://dailyinning.com',
  }));

  expect(shareText).toBe([
    'Daily Inning #42',
    'by Initial Baseball',
    '',
    '8/15 PTS · 1 K',
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

function applyOutcome(
  gameState: DailyGameState,
  outcome: 'HR' | '2B' | 'K',
  initials: string,
  pitchNumber: number,
): DailyGameState {
  const nextState = applyDailyOutcomeForRuleset({
    rulesetVersion: gameState.rulesetVersion,
    inning: gameState.inning,
    score: gameState.score,
    points: gameState.points,
    outcome,
    totalAtBats: gameState.puzzle.pitches.length,
  });
  const completedAtBat: DailyCompletedAtBat = {
    pitchNumber,
    initials,
    outcome,
    hintsRevealed: outcome === 'HR' ? 0 : outcome === '2B' ? 2 : 0,
    wrongGuesses: outcome === 'K' ? 3 : 0,
    resolution: outcome === 'K' ? 'strikeout' : 'correct',
  };

  return {
    ...gameState,
    inning: nextState.inning,
    score: nextState.score,
    points: nextState.points,
    completedAtBats: [...gameState.completedAtBats, completedAtBat],
    completedPitchLines: [...gameState.completedPitchLines, { initials, outcome }],
  };
}
