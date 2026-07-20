import { expect, it } from 'vitest';
import { searchCanonicalPlayers, type PlayerSearchCandidate } from './searchPlayers.js';

const benTaylors: PlayerSearchCandidate[] = [
  buildPlayer('ibp_hitter', 'hitter', '1B', 1951, 1955, 'DET, ML1, SLA'),
  buildPlayer('ibp_hof', 'two-way', '1B', 1910, 1929, 'ABC, WBS'),
  buildPlayer('ibp_pitcher', 'pitcher', 'P', 2017, 2018, 'BOS, CLE'),
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

it('returns career, role, position, and team context for disambiguation', () => {
  expect(searchCanonicalPlayers('ben taylor', benTaylors)[2]?.metadata).toMatchObject({
    firstYear: 2017,
    lastYear: 2018,
    playerType: 'pitcher',
    primaryPosition: 'P',
    teamsDisplay: 'BOS, CLE',
  });
});

function buildPlayer(
  id: string,
  playerType: string,
  primaryPosition: string,
  firstYear: number,
  lastYear: number,
  teamsDisplay: string,
): PlayerSearchCandidate {
  return {
    id,
    displayName: 'Ben Taylor',
    aliases: [],
    playerType,
    primaryPosition,
    firstYear,
    lastYear,
    teamsDisplay,
  };
}
