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
  teamsDisplay: 'SEA, CIN, CHW',
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
