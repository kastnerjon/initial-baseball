'use client';

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import {
  type PlayerSearchResult,
} from '@initial-baseball/engine';
import type { DailyGuessResult, DailyPublicPuzzlePitch } from '@initial-baseball/shared';
import type { CanonicalRevealViewModel } from '../canonicalRevealViewModel';
import type { DailyHintResponse } from '../dailyRuntimeContracts';
import { PlayerRevealCard } from './PlayerRevealCard';
import { ResultDisplay } from './ResultDisplay';
import { ResultsDropdown } from './ResultsDropdown';
import { SearchInput } from './SearchInput';

type AtBatCardProps = {
  atBat: DailyPublicPuzzlePitch;
  state: {
    query: string;
    selectedPlayerId: string | null;
    revealCount: 0 | 1 | 2 | 3 | 4;
    revealedHints: DailyHintResponse['hint'][];
    strikeCount: number;
    submittedResult: DailyGuessResult | null;
    reveal: CanonicalRevealViewModel | null;
  };
  requestPending: boolean;
  requestError: string | null;
  onQueryChange: (query: string) => void;
  onSelectPlayer: (result: PlayerSearchResult) => void;
  onRevealHint: () => void;
  onSubmit: () => void;
  onGiveUp: () => void;
  onNextPitch: () => void;
};

export function AtBatCard({
  atBat,
  state,
  requestPending,
  requestError,
  onQueryChange,
  onSelectPlayer,
  onRevealHint,
  onSubmit,
  onGiveUp,
  onNextPitch,
}: AtBatCardProps): JSX.Element {
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const hasRevealedAllHints = state.revealCount >= 4;
  const resolvedTerminalResult = state.submittedResult !== null && state.submittedResult.kind !== 'incorrect'
    ? state.submittedResult
    : null;

  useEffect(() => {
    const query = state.query.trim();
    if (query.length === 0 || state.selectedPlayerId !== null) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => {
      void fetch(`/api/players/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Search failed with ${response.status}.`);
          return response.json() as Promise<{ results?: PlayerSearchResult[] }>;
        })
        .then((payload) => setResults(Array.isArray(payload.results) ? payload.results.slice(0, 5) : []))
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setResults([]);
        });
    }, 120);
    return () => {
      globalThis.clearTimeout(timer);
      controller.abort();
    };
  }, [state.query, state.selectedPlayerId]);

  if (resolvedTerminalResult !== null) {
    return (
      <div className="at-bat-card">
        <div className="pitch-meta">
          <span className="pitch-number">{`At Bat ${atBat.pitchNumber}`}</span>
          <CountIndicator label="Strikes" filledCount={state.strikeCount} total={3} />
        </div>
        <ResultDisplay result={resolvedTerminalResult} />
        {state.reveal === null ? null : <PlayerRevealCard reveal={state.reveal} />}
        <OutcomeDistributionPlaceholder />
        <button
          type="button"
          className="button-primary"
          onClick={onNextPitch}
        >
          Next At Bat
        </button>
      </div>
    );
  }

  return (
    <div className="at-bat-card">
      <div className="pitch-meta">
        <span className="pitch-number">{`At Bat ${atBat.pitchNumber}`}</span>
        <CountIndicator label="Strikes" filledCount={state.strikeCount} total={3} />
      </div>

      <div className="initials-block">
        <span className="initials-label">Up Now</span>
        <strong className="initials-value">{atBat.initials}</strong>
      </div>

      <div className="hint-block">
        <div className="hint-list">
          {state.revealedHints.length === 0 ? (
            <div>
              <span className="hint-label">Hints</span>
              <p className="hint-value">None revealed yet.</p>
            </div>
          ) : (
            state.revealedHints.map((hint) => (
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
          disabled={hasRevealedAllHints || requestPending}
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
      {requestError === null ? null : <p role="alert">{requestError}</p>}

      <div className="at-bat-actions">
        <button
          type="button"
          className="button-secondary button-give-up"
          onClick={onGiveUp}
          disabled={requestPending}
        >
          Give up
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={onSubmit}
          disabled={state.selectedPlayerId === null || requestPending}
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
      {/* TODO: Replace with persisted public Daily results grouped by puzzleNumber, at-bat number, and outcome. */}
      <p className="result-note">Outcome distribution will appear once public results are collected.</p>
    </section>
  );
}
