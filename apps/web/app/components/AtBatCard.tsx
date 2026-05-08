'use client';

import type { JSX } from 'react';
import { useMemo } from 'react';
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
    fullName: string;
  };
  hints: Array<{
    hintLabel: string;
    hintValue: string;
  }>;
};

type AtBatCardProps = {
  atBat: AtBatCardPitch;
  players: Player[];
  state: {
    query: string;
    selectedPlayerId: string | null;
    selectedAcceptedPlayerIds: string[] | null;
    revealCount: 0 | 1 | 2 | 3 | 4;
    strikeCount: number;
    submittedResult: DailyGuessResult | null;
  };
  onQueryChange: (query: string) => void;
  onSelectPlayer: (result: PlayerSearchResult) => void;
  onRevealHint: () => void;
  onSubmit: () => void;
  onGiveUp: () => void;
  onNextPitch: () => void;
};

export function AtBatCard({
  atBat,
  players,
  state,
  onQueryChange,
  onSelectPlayer,
  onRevealHint,
  onSubmit,
  onGiveUp,
  onNextPitch,
}: AtBatCardProps): JSX.Element {
  const results = useMemo(() => searchPlayers(state.query, players).slice(0, 5), [players, state.query]);
  const revealedHints = atBat.hints.slice(0, state.revealCount);
  const hasRevealedAllHints = state.revealCount >= atBat.hints.length;
  const resolvedTerminalResult = state.submittedResult !== null && state.submittedResult.kind !== 'incorrect'
    ? state.submittedResult
    : null;

  if (resolvedTerminalResult !== null) {
    return (
      <div className="at-bat-card">
        <div className="pitch-meta">
          <span className="pitch-number">{`Pitch ${atBat.pitchNumber}`}</span>
          <CountIndicator label="Strikes" filledCount={state.strikeCount} total={3} />
        </div>
        <ResultDisplay
          result={resolvedTerminalResult}
          correctAnswer={atBat.player.fullName}
          revealAnswer={resolvedTerminalResult.kind === 'strikeout'}
        />
        <OutcomeDistributionPlaceholder />
        <button
          type="button"
          className="button-primary"
          onClick={onNextPitch}
        >
          Next Pitch
        </button>
      </div>
    );
  }

  return (
    <div className="at-bat-card">
      <div className="pitch-meta">
        <span className="pitch-number">{`Pitch ${atBat.pitchNumber}`}</span>
        <CountIndicator label="Strikes" filledCount={state.strikeCount} total={3} />
      </div>

      <div className="initials-block">
        <span className="initials-label">Up Now</span>
        <strong className="initials-value">{atBat.player.initials}</strong>
      </div>

      <div className="hint-block">
        <div className="hint-list">
          {revealedHints.length === 0 ? (
            <div>
              <span className="hint-label">Hints</span>
              <p className="hint-value">None revealed yet.</p>
            </div>
          ) : (
            revealedHints.map((hint) => (
              <div key={hint.hintLabel} className="revealed-hint">
                <span className="hint-label">{hint.hintLabel}</span>
                <p className="hint-value">{hint.hintValue}</p>
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={onRevealHint}
          disabled={hasRevealedAllHints}
        >
          Reveal Next Hint
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

      <div className="at-bat-actions">
        <button
          type="button"
          className="button-secondary button-give-up"
          onClick={onGiveUp}
        >
          Give up
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={onSubmit}
          disabled={state.selectedPlayerId === null}
        >
          Submit Guess
        </button>
      </div>
    </div>
  );

  function handleSelect(result: PlayerSearchResult): void {
    onSelectPlayer(result);
  }
}

function CountIndicator({
  label,
  filledCount,
  total,
}: {
  label: string;
  filledCount: number;
  total: number;
}): JSX.Element {
  return (
    <div className="at-bat-count">
      <span className="at-bat-count-label">{label}</span>
      <div className="at-bat-count-markers" aria-label={label}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={`${label}-${index}`}
            className={index < filledCount ? 'at-bat-count-marker filled' : 'at-bat-count-marker'}
            aria-hidden="true"
          >
            {index < filledCount ? '●' : '○'}
          </span>
        ))}
      </div>
    </div>
  );
}

function OutcomeDistributionPlaceholder(): JSX.Element {
  return (
    <section className="outcome-distribution-card">
      <span className="field-label">Field Results</span>
      {/* TODO: Replace with persisted public Daily results grouped by puzzleNumber, pitchNumber, and outcome. */}
      <p className="result-note">Outcome distribution will appear once public results are collected.</p>
    </section>
  );
}
