'use client';

import type { JSX } from 'react';
import { useState } from 'react';
import {
  evaluateGuess,
  getGuessOutcome,
  searchPlayers,
  type PlayerSearchResult,
} from '@initial-baseball/engine';
import type { DailyGuessResult, Player } from '@initial-baseball/shared';
import { ResultDisplay } from './ResultDisplay';
import { ResultsDropdown } from './ResultsDropdown';
import { SearchInput } from './SearchInput';

export type SingleAtBatDemo = {
  puzzleNumber: number;
  initials: string;
  hintLabel: string;
  hintValue: string;
  correctPlayerId: string;
};

type AtBatCardProps = {
  atBat: SingleAtBatDemo;
  players: Player[];
};

export function AtBatCard({ atBat, players }: AtBatCardProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [revealCount, setRevealCount] = useState<0 | 1>(0);
  const [submittedResult, setSubmittedResult] = useState<DailyGuessResult | null>(null);

  const results = searchPlayers(query, players).slice(0, 5);
  const hasRevealedHint = revealCount === 1;

  if (submittedResult !== null) {
    return <ResultDisplay result={submittedResult} />;
  }

  return (
    <div className="at-bat-card">
      <div className="initials-block">
        <span className="initials-label">Initials</span>
        <strong className="initials-value">{atBat.initials}</strong>
      </div>

      <div className="hint-block">
        <div>
          <span className="hint-label">{atBat.hintLabel}</span>
          <p className="hint-value">{hasRevealedHint ? atBat.hintValue : 'Hidden'}</p>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={() => setRevealCount(1)}
          disabled={hasRevealedHint}
        >
          Reveal Hint
        </button>
      </div>

      <div className="search-shell">
        <SearchInput
          value={query}
          onChange={(nextValue) => {
            setQuery(nextValue);
            setSelectedPlayerId(null);
          }}
        />
        <ResultsDropdown
          results={results}
          visible={query.trim().length > 0}
          selectedPlayerId={selectedPlayerId}
          onSelect={handleSelect}
        />
      </div>

      <button
        type="button"
        className="button-primary"
        onClick={handleSubmit}
        disabled={selectedPlayerId === null}
      >
        Submit Guess
      </button>
    </div>
  );

  function handleSelect(result: PlayerSearchResult): void {
    setSelectedPlayerId(result.playerId);
    setQuery(result.displayName);
  }

  function handleSubmit(): void {
    if (selectedPlayerId === null) {
      return;
    }

    const isCorrect = evaluateGuess(selectedPlayerId, atBat.correctPlayerId);
    const outcome = getGuessOutcome({
      isCorrect,
      revealCount,
      strikeCount: 0,
      maxStrikes: 3,
    });

    setSubmittedResult(outcome);
  }
}
