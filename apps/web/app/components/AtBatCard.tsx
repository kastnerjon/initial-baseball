'use client';

import type { JSX } from 'react';
import {
  searchPlayers,
  type PlayerSearchResult,
} from '@initial-baseball/engine';
import type { DailyGuessResult, Player } from '@initial-baseball/shared';
import { ResultDisplay } from './ResultDisplay';
import { ResultsDropdown } from './ResultsDropdown';
import { SearchInput } from './SearchInput';

export type AtBatCardPitch = {
  pitchNumber: number;
  player: {
    initials: string;
  };
  hintLabel: string;
  hintValue: string;
};

type AtBatCardProps = {
  atBat: AtBatCardPitch;
  players: Player[];
  state: {
    query: string;
    selectedPlayerId: string | null;
    revealCount: 0 | 1;
    strikeCount: number;
    submittedResult: DailyGuessResult | null;
  };
  onQueryChange: (query: string) => void;
  onSelectPlayer: (playerId: string, displayName: string) => void;
  onRevealHint: () => void;
  onSubmit: () => void;
};

export function AtBatCard({
  atBat,
  players,
  state,
  onQueryChange,
  onSelectPlayer,
  onRevealHint,
  onSubmit,
}: AtBatCardProps): JSX.Element {
  const results = searchPlayers(state.query, players).slice(0, 5);
  const hasRevealedHint = state.revealCount === 1;

  return (
    <div className="at-bat-card">
      <div className="pitch-meta">
        <span>{`Pitch ${atBat.pitchNumber}`}</span>
        <span>{`Strikes ${state.strikeCount}/3`}</span>
      </div>

      <div className="initials-block">
        <span className="initials-label">Initials</span>
        <strong className="initials-value">{atBat.player.initials}</strong>
      </div>

      <div className="hint-block">
        <div>
          <span className="hint-label">{atBat.hintLabel}</span>
          <p className="hint-value">{hasRevealedHint ? atBat.hintValue : 'Hidden'}</p>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={onRevealHint}
          disabled={hasRevealedHint}
        >
          Reveal Hint
        </button>
      </div>

      <div className="search-shell">
        <SearchInput
          value={state.query}
          onChange={onQueryChange}
        />
        <ResultsDropdown
          results={results}
          visible={state.query.trim().length > 0}
          selectedPlayerId={state.selectedPlayerId}
          onSelect={handleSelect}
        />
      </div>

      {state.submittedResult !== null && state.submittedResult.kind === 'incorrect' ? (
        <ResultDisplay result={state.submittedResult} />
      ) : null}

      <button
        type="button"
        className="button-primary"
        onClick={onSubmit}
        disabled={state.selectedPlayerId === null}
      >
        Submit Guess
      </button>
    </div>
  );

  function handleSelect(result: PlayerSearchResult): void {
    onSelectPlayer(result.playerId, result.displayName);
  }
}
