import { expect, it } from 'vitest';
import type { Player } from '@initial-baseball/shared';
import { normalizeGuess } from './normalizeGuess.js';
import { searchPlayers } from './searchPlayers.js';

const players: Player[] = [
  {
    id: 'david-wright',
    fullName: 'David Wright',
    displayName: 'David Wright',
    primaryRole: 'hitter',
    primaryPosition: '3B',
    mainDecade: '2000s',
    primaryTeam: 'NYM',
    teamsDisplay: 'NYM',
    statsLine: 'HR 242 / RBI 970 / BA .296 / OBP .376 / SB 196',
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: ['Captain America'],
  },
  {
    id: 'david-ortiz-duplicate-non-eligible',
    fullName: 'David Ortiz',
    displayName: 'David Ortiz',
    primaryRole: 'hitter',
    primaryPosition: 'DH',
    mainDecade: '2000s',
    primaryTeam: 'BOS',
    teamsDisplay: 'MIN, BOS',
    statsLine: 'HR 541 / RBI 1768 / BA .286 / OBP .380 / SB 17',
    dailyEligibilityTier: 'none',
    dailyEligible: false,
    aliases: ['Big Papi'],
  },
  {
    id: 'david-ortiz',
    fullName: 'David Ortiz',
    displayName: 'David Ortiz',
    primaryRole: 'hitter',
    primaryPosition: 'DH',
    mainDecade: '2000s',
    primaryTeam: 'BOS',
    teamsDisplay: 'MIN, BOS',
    statsLine: 'HR 541 / RBI 1768 / BA .286 / OBP .380 / SB 17',
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: ['Big Papi'],
  },
  {
    id: 'david-ortiz-duplicate-core',
    fullName: 'David Ortiz',
    displayName: 'David Ortiz',
    primaryRole: 'hitter',
    primaryPosition: 'DH',
    mainDecade: '2000s',
    primaryTeam: 'BOS',
    teamsDisplay: 'MIN, BOS',
    statsLine: 'HR 541 / RBI 1768 / BA .286 / OBP .380 / SB 17',
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: ['Big Papi'],
  },
  {
    id: 'david-cone',
    fullName: 'David Cone',
    displayName: 'David Cone',
    primaryRole: 'pitcher',
    primaryPosition: 'SP',
    mainDecade: '1990s',
    primaryTeam: 'TOR',
    teamsDisplay: 'KCR, NYM, TOR, NYY, BOS',
    statsLine: 'W 194 / L 126 / ERA 3.46 / WHIP 1.17 / K 2668',
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  },
  {
    id: 'cc-sabathia',
    fullName: 'C.C. Sabathia',
    displayName: 'CC Sabathia',
    primaryRole: 'pitcher',
    primaryPosition: 'SP',
    mainDecade: '2000s',
    primaryTeam: 'NYY',
    teamsDisplay: 'CLE, MIL, NYY',
    statsLine: 'W 251 / L 161 / ERA 3.74 / WHIP 1.26 / K 3093',
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: ['Carsten Sabathia'],
  },
  {
    id: 'oneil-cruz',
    fullName: "O'Neil Cruz",
    displayName: "O'Neil Cruz",
    primaryRole: 'hitter',
    primaryPosition: 'SS',
    mainDecade: '2020s',
    primaryTeam: 'PIT',
    teamsDisplay: 'PIT',
    statsLine: 'HR 49 / RBI 131 / BA .251 / OBP .320 / SB 32',
    dailyEligibilityTier: 'none',
    dailyEligible: false,
    aliases: [],
  },
  {
    id: 'chris-davis-hitter',
    fullName: 'Chris Davis',
    displayName: 'Chris Davis',
    primaryRole: 'hitter',
    primaryPosition: '1B',
    mainDecade: '2010s',
    primaryTeam: 'BAL',
    teamsDisplay: 'TEX, BAL',
    statsLine: 'HR 295 / RBI 780 / BA .233 / OBP .315 / SB 7',
    dailyEligibilityTier: 'extended',
    dailyEligible: true,
    aliases: [],
  },
  {
    id: 'chris-davis-pitcher',
    fullName: 'Chris Davis',
    displayName: 'Chris Davis',
    primaryRole: 'pitcher',
    primaryPosition: 'P',
    mainDecade: '1990s',
    primaryTeam: 'SEA',
    teamsDisplay: 'SEA',
    statsLine: 'W 0 / L 0 / ERA 8.31 / WHIP 2.08 / K 4',
    dailyEligibilityTier: 'none',
    dailyEligible: false,
    aliases: [],
  },
  {
    id: 'luis-arraez',
    fullName: 'Luis Reveron Arráez',
    displayName: 'Luis Reveron Arráez',
    primaryRole: 'hitter',
    primaryPosition: '2B',
    mainDecade: '2020s',
    primaryTeam: 'MIN',
    teamsDisplay: 'MIN, MIA, SD',
    statsLine: 'HR 28 / RBI 247 / BA .323 / OBP .372 / SB 15',
    dailyEligibilityTier: 'extended',
    dailyEligible: true,
    aliases: ['Luis Sangel Arráez'],
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

it('dedupes repeated visible player names from search results', () => {
  const results = searchPlayers('david ort', players);

  expect(results.map((player) => player.displayName)).toEqual(['David Ortiz']);
  expect(results[0]?.playerId).toBe('david-ortiz');
  expect(results[0]?.acceptedPlayerIds).toEqual([
    'david-ortiz',
    'david-ortiz-duplicate-core',
    'david-ortiz-duplicate-non-eligible',
  ]);
});

it('does not return duplicate normalized display names', () => {
  const normalizedDisplayNames = searchPlayers('david', players).map((player) => normalizeGuess(player.displayName));

  expect(new Set(normalizedDisplayNames).size).toBe(normalizedDisplayNames.length);
});

it('normalizes punctuation and repeated spaces in queries', () => {
  expect(searchPlayers('  c.c.,   sab  ', players)[0]?.playerId).toBe('cc-sabathia');
  expect(searchPlayers("  o'neil  ", players)[0]?.playerId).toBe('oneil-cruz');
});

it('groups same-name players into one visible result with all accepted ids', () => {
  const results = searchPlayers('chris davis', players);

  expect(results.map((player) => player.displayName)).toEqual(['Chris Davis']);
  expect(results[0]?.playerId).toBe('chris-davis-hitter');
  expect(results[0]?.acceptedPlayerIds).toEqual(['chris-davis-hitter', 'chris-davis-pitcher']);
});

it('matches accented names with unaccented and accented queries', () => {
  for (const query of ['luis arraez', 'arraez', 'luis arráez', 'arráez']) {
    expect(searchPlayers(query, players)[0]?.playerId).toBe('luis-arraez');
  }
});

it('limits and stabilizes results for deterministic ordering', () => {
  const results = searchPlayers('david', players);
  expect(results).toHaveLength(3);
  expect(results[0]?.displayName).toBe('David Cone');
  expect(results[1]?.displayName).toBe('David Ortiz');
  expect(results[2]?.displayName).toBe('David Wright');
});
