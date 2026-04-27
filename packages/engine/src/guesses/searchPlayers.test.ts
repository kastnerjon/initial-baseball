import { expect, it } from 'vitest';
import type { Player } from '@initial-baseball/shared';
import { searchPlayers } from './searchPlayers.js';

const players: Player[] = [
  {
    id: 'david-wright',
    fullName: 'David Wright',
    displayName: 'David Wright',
    primaryRole: 'hitter',
    primaryPosition: '3B',
    mainDecade: '2000s',
    teamsDisplay: 'NYM',
    aliases: ['Captain America'],
  },
  {
    id: 'david-ortiz',
    fullName: 'David Ortiz',
    displayName: 'David Ortiz',
    primaryRole: 'hitter',
    primaryPosition: 'DH',
    mainDecade: '2000s',
    teamsDisplay: 'MIN, BOS',
    aliases: ['Big Papi'],
  },
  {
    id: 'david-cone',
    fullName: 'David Cone',
    displayName: 'David Cone',
    primaryRole: 'pitcher',
    primaryPosition: 'SP',
    mainDecade: '1990s',
    teamsDisplay: 'KCR, NYM, TOR, NYY, BOS',
    aliases: [],
  },
  {
    id: 'cc-sabathia',
    fullName: 'C.C. Sabathia',
    displayName: 'CC Sabathia',
    primaryRole: 'pitcher',
    primaryPosition: 'SP',
    mainDecade: '2000s',
    teamsDisplay: 'CLE, MIL, NYY',
    aliases: ['Carsten Sabathia'],
  },
  {
    id: 'oneil-cruz',
    fullName: "O'Neil Cruz",
    displayName: "O'Neil Cruz",
    primaryRole: 'hitter',
    primaryPosition: 'SS',
    mainDecade: '2020s',
    teamsDisplay: 'PIT',
    aliases: [],
  },
];

it('returns multiple players for a shared name fragment', () => {
  expect(searchPlayers('david', players).map((player) => player.playerId)).toEqual([
    'david-cone',
    'david-ortiz',
    'david-wright',
  ]);
});

it('ranks a more specific starts-with match highly', () => {
  expect(searchPlayers('david wri', players)[0]?.playerId).toBe('david-wright');
});

it('matches aliases using substring search', () => {
  expect(searchPlayers('papi', players).map((player) => player.playerId)).toEqual(['david-ortiz']);
});

it('normalizes punctuation and repeated spaces in queries', () => {
  expect(searchPlayers('  c.c.,   sab  ', players)[0]?.playerId).toBe('cc-sabathia');
  expect(searchPlayers("  o'neil  ", players)[0]?.playerId).toBe('oneil-cruz');
});

it('limits and stabilizes results for deterministic ordering', () => {
  const results = searchPlayers('david', players);
  expect(results).toHaveLength(3);
  expect(results[0]?.displayName).toBe('David Cone');
  expect(results[1]?.displayName).toBe('David Ortiz');
  expect(results[2]?.displayName).toBe('David Wright');
});
