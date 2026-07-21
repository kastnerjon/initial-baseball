import type { PlayerSearchResult } from '@initial-baseball/engine';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ResultsDropdown } from './ResultsDropdown';

it('renders only the name for a unique player even when other metadata is available', () => {
  const markup = renderResultsDropdown({
    playerId: 'burneaj01',
    acceptedPlayerIds: ['burneaj01'],
    displayName: 'A. J. Burnett',
    fullName: 'A. J. Burnett',
    requiresYearDisambiguation: false,
    metadata: {
      firstYear: 1999,
      lastYear: 2015,
      playerType: 'pitcher',
      primaryPosition: 'P',
      teamsDisplay: 'FLO, NYA, PHI, PIT, TOR',
    },
  });

  expect(markup).toContain('A. J. Burnett');
  expect(markup).not.toContain('1999');
  expect(markup).not.toContain('pitcher');
  expect(markup).not.toContain('FLO');
});

it('renders career years, but not position or teams, for a duplicate visible name', () => {
  const markup = renderResultsDropdown({
    playerId: 'ben-taylor-early',
    acceptedPlayerIds: ['ben-taylor-early'],
    displayName: 'Ben Taylor',
    fullName: 'Ben Taylor',
    requiresYearDisambiguation: true,
    metadata: {
      firstYear: 1898,
      lastYear: 1901,
      playerType: 'hitter',
      primaryPosition: '1B',
      teamsDisplay: 'NYG',
    },
  });

  expect(markup).toContain('Ben Taylor');
  expect(markup).toContain('1898–1901');
  expect(markup).not.toContain('hitter');
  expect(markup).not.toContain('NYG');
});

function renderResultsDropdown(result: PlayerSearchResult): string {
  return renderToStaticMarkup(
    <ResultsDropdown
      results={[result]}
      visible
      selectedPlayerId={null}
      onSelect={() => undefined}
    />,
  );
}
