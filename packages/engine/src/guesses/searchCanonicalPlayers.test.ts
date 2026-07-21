import { expect, it } from 'vitest';
import { searchCanonicalPlayers, type PlayerSearchCandidate } from './searchPlayers.js';

const benTaylors: PlayerSearchCandidate[] = [
  buildPlayer('ibp_hitter', 'Ben Taylor', 'hitter', '1B', 1951, 1955, 'DET, ML1, SLA'),
  buildPlayer('ibp_hof', 'Ben Taylor', 'two-way', '1B', 1910, 1929, 'ABC, WBS'),
  buildPlayer('ibp_pitcher', 'Ben Taylor', 'pitcher', 'P', 2017, 2018, 'BOS, CLE'),
];

it('keeps genuine same-name canonical players as distinct search results', () => {
  const results = searchCanonicalPlayers('ben taylor', benTaylors);
  expect(results.map((result) => result.playerId)).toEqual([
    'ibp_hitter',
    'ibp_hof',
    'ibp_pitcher',
  ]);
  expect(results.map((result) => result.acceptedPlayerIds)).toEqual([
    ['ibp_hitter'],
    ['ibp_hof'],
    ['ibp_pitcher'],
  ]);
});

it('requests year disambiguation for every distinct canonical player sharing a visible name', () => {
  const results = searchCanonicalPlayers('ben taylor', benTaylors);

  expect(results.every((result) => result.requiresYearDisambiguation)).toBe(true);
  expect(results.map((result) => [
    result.metadata?.firstYear,
    result.metadata?.lastYear,
  ])).toEqual([
    [1951, 1955],
    [1910, 1929],
    [2017, 2018],
  ]);
});

it('does not request year disambiguation for a unique visible name', () => {
  const results = searchCanonicalPlayers('burnett', [
    buildPlayer('burneaj01', 'A. J. Burnett', 'pitcher', 'P', 1999, 2015, 'FLO, NYA, PHI, PIT, TOR'),
  ]);

  expect(results[0]).toMatchObject({
    playerId: 'burneaj01',
    requiresYearDisambiguation: false,
    metadata: { firstYear: 1999, lastYear: 2015 },
  });
});

it('uses the complete candidate universe when the other duplicate falls outside the result limit', () => {
  const candidates = [
    ...Array.from({ length: 9 }, (_, index) => buildPlayer(
      `before-ben-${index}`,
      `B${String.fromCharCode(97 + index)} Player`,
      'hitter',
      '1B',
      1900 + index,
      1901 + index,
      'TST',
    )),
    buildPlayer('ben-taylor-first', 'Ben Taylor', 'hitter', '1B', 1898, 1901, 'NYG'),
    buildPlayer('ben-taylor-second', 'Ben Taylor', 'hitter', '1B', 1912, 1929, 'ABC'),
  ];

  const results = searchCanonicalPlayers('b', candidates);
  const visibleBenTaylorResults = results.filter((result) => result.displayName === 'Ben Taylor');

  expect(results).toHaveLength(10);
  expect(visibleBenTaylorResults).toHaveLength(1);
  expect(visibleBenTaylorResults[0]?.requiresYearDisambiguation).toBe(true);
});

function buildPlayer(
  id: string,
  displayName: string,
  playerType: string,
  primaryPosition: string,
  firstYear: number,
  lastYear: number,
  teamsDisplay: string,
): PlayerSearchCandidate {
  return {
    id,
    displayName,
    aliases: [],
    playerType,
    primaryPosition,
    firstYear,
    lastYear,
    teamsDisplay,
  };
}
