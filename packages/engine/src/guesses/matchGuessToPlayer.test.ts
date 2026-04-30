import { expect, it } from 'vitest';
import type { Player } from '@initial-baseball/shared';
import { matchGuessToPlayer } from './matchGuessToPlayer.js';

const player: Player = {
  id: 'player-1',
  fullName: 'Ken Griffey Jr.',
  displayName: 'Ken Griffey Jr.',
  primaryRole: 'hitter',
  primaryPosition: 'CF',
  mainDecade: '1990s',
  primaryTeam: 'SEA',
  teamsDisplay: 'SEA, CIN, CHW',
  statsLine: 'HR 630 / RBI 1836 / BA .284 / OBP .370 / SB 184',
  dailyEligibilityTier: 'core',
  dailyEligible: true,
  aliases: ['The Kid', 'Ken Griffey'],
};

it('matches canonical names and aliases after normalization', () => {
  expect(matchGuessToPlayer('Ken Griffey Jr', player)).toBe(true);
  expect(matchGuessToPlayer('the kid', player)).toBe(true);
  expect(matchGuessToPlayer('Ken Griffey', player)).toBe(true);
});

it('does not match unrelated players', () => {
  expect(matchGuessToPlayer('Barry Bonds', player)).toBe(false);
});
