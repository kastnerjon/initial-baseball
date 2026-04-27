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
      {results.map((result) => (
        <li key={result.playerId}>
          <button
            type="button"
            className={result.playerId === selectedPlayerId ? 'result-option selected' : 'result-option'}
            onClick={() => onSelect(result)}
          >
            {result.displayName}
          </button>
        </li>
      ))}
    </ul>
  );
}
