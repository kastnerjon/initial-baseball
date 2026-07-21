import type { JSX } from 'react';
import type { PlayerSearchResult } from '@initial-baseball/engine';

type ResultsDropdownProps = {
  results: PlayerSearchResult[];
  visible: boolean;
  selectedPlayerId: string | null;
  onSelect: (result: PlayerSearchResult) => void;
};

export function ResultsDropdown({
  results,
  visible,
  selectedPlayerId,
  onSelect,
}: ResultsDropdownProps): JSX.Element | null {
  if (!visible) {
    return null;
  }

  if (results.length === 0) {
    return <div className="results-dropdown empty">No matching players</div>;
  }

  return (
    <ul className="results-dropdown" aria-label="Matching players">
      {results.map((result) => {
        const context = formatSearchResultContext(result);

        return (
          <li key={result.playerId}>
            <button
              type="button"
              className={result.playerId === selectedPlayerId ? 'result-option selected' : 'result-option'}
              onClick={() => onSelect(result)}
            >
              <span>{result.displayName}</span>
              {context === null ? null : <small>{context}</small>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function formatSearchResultContext(result: PlayerSearchResult): string | null {
  if (result.requiresYearDisambiguation !== true) return null;

  const firstYear = result.metadata?.firstYear;
  if (firstYear === null || firstYear === undefined) return null;

  return `${firstYear}–${result.metadata?.lastYear ?? 'present'}`;
}
