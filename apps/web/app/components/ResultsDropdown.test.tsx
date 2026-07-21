import type { PlayerSearchResult } from '@initial-baseball/engine';
import { expect, it } from 'vitest';
import { formatSearchResultContext } from './ResultsDropdown';

it('returns no secondary context for a unique player even when other metadata is available', () => {
  expect(formatSearchResultContext(result({
    firstYear: 1999,
    lastYear: 2015,
    playerType: 'pitcher',
    primaryPosition: 'P',
    teamsDisplay: 'FLO, NYA, PHI, PIT, TOR',
  }))).toBeNull();
});

it('returns career years only for a duplicate visible name', () => {
  expect(formatSearchResultContext({
    ...result({
      firstYear: 1898,
      lastYear: 1901,
      playerType: 'hitter',
      primaryPosition: '1B',
      teamsDisplay: 'NYG',
    }),
    requiresYearDisambiguation: true,
  })).toBe('1898–1901');
});

it('does not invent context when duplicate career years are unavailable', () => {
  expect(formatSearchResultContext({
    ...result({
      firstYear: null,
      lastYear: null,
      playerType: 'pitcher',
      primaryPosition: 'P',
      teamsDisplay: 'BOS',
    }),
    requiresYearDisambiguation: true,
  })).toBeNull();
});

function result(metadata: NonNullable<PlayerSearchResult['metadata']>): PlayerSearchResult {
  return {
    playerId: 'test-player',
    acceptedPlayerIds: ['test-player'],
    displayName: 'Test Player',
    fullName: 'Test Player',
    metadata,
  };
}
