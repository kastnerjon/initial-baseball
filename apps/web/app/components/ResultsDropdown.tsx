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
            <span>{result.displayName}</span>
            {formatContext(result) === null ? null : (
              <small>{formatContext(result)}</small>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatContext(result: PlayerSearchResult): string | null {
  const metadata = result.metadata;
  if (metadata === undefined) return null;
  const years = metadata.firstYear === null || metadata.firstYear === undefined
    ? null
    : `${metadata.firstYear}–${metadata.lastYear ?? 'present'}`;
  const role = metadata.playerType ?? metadata.primaryPosition;
  const teams = metadata.teamsDisplay;
  const context = [years, role, teams].filter((value): value is string => Boolean(value));
  return context.length === 0 ? null : context.join(' · ');
}
