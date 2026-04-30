import { expect, it } from 'vitest';
import type { Player } from '@initial-baseball/shared';
import { selectRandomPracticePlayer } from './selectRandomPracticePlayer.js';

const players: Player[] = [
  {
    id: 'p1',
    fullName: 'Ken Griffey Jr.',
    displayName: 'Ken Griffey Jr.',
    primaryRole: 'hitter',
    primaryPosition: 'CF',
    mainDecade: '1990s',
    teamsDisplay: 'SEA, CIN, CHW',
    statsLine: 'HR 630 / RBI 1836 / BA .284 / OBP .370 / SB 184',
    aliases: [],
  },
  {
    id: 'p2',
    fullName: 'Pedro Martinez',
    displayName: 'Pedro Martinez',
    primaryRole: 'pitcher',
    primaryPosition: 'SP',
    mainDecade: '1990s',
    teamsDisplay: 'LAD, MON, BOS, NYM, PHI',
    statsLine: 'W 219 / L 100 / ERA 2.93 / WHIP 1.05 / K 3154',
    aliases: [],
  },
];

it('selects a deterministic practice player with injectable rng', () => {
  expect(selectRandomPracticePlayer(players, () => 0).id).toBe('p1');
  expect(selectRandomPracticePlayer(players, () => 0.99).id).toBe('p2');
});

it('rejects empty player lists', () => {
  expect(() => selectRandomPracticePlayer([], () => 0)).toThrow('Cannot select a practice player from an empty player list.');
});
