'use client';

import React, { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import {
  createCustomLineupV2BrowserTransport, CustomLineupV2TransportError,
  type CustomLineupV2BrowserState, type CustomLineupV2BrowserResolution,
} from '../customLineupV2BrowserTransport';
import { createDailyGameplayRequestController } from '../dailyGameplayRequestController';
import { CustomLineupScorecard } from './CustomLineupScorecard';
import { CustomLineupTerminalPanel } from './CustomLineupTerminalPanel';

type Candidate = { playerId: string; displayName: string };
function isCandidate(value: unknown): value is Candidate {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.playerId === 'string' && /^ibp_[0-9a-f]{20}$/.test(candidate.playerId)
    && typeof candidate.displayName === 'string' && candidate.displayName.trim().length > 0;
}
function errorMessage(error: unknown): string {
  if (error instanceof CustomLineupV2TransportError) {
    if (error.kind === 'not_found') return 'This lineup is not available.';
    if (error.kind === 'invalid_credential') return 'This browser cannot access that attempt.';
    if (error.kind === 'completed') return 'This lineup is already finished in this browser.';
  }
  return 'Could not reach the game server. Your saved progress has not been reset.';
}
type Terminal = Extract<CustomLineupV2BrowserResolution, { kind: 'terminal' }>;

/** Server-authoritative, same-browser Custom v2 game. A refresh reopens the
 * durable first attempt; local state is display-only and never authoritative.
 */
export function CustomLineupGame({ puzzleId, displayTitle = null }: {
  puzzleId: string; displayTitle?: string | null;
}): JSX.Element {
  // A different puzzle is a different browser request/state lifetime.
  return <CustomLineupGameSession key={puzzleId} puzzleId={puzzleId} displayTitle={displayTitle} />;
}

function CustomLineupGameSession({ puzzleId, displayTitle }: {
  puzzleId: string; displayTitle: string | null;
}): JSX.Element {
  const client = useMemo(() => createCustomLineupV2BrowserTransport(), []);
  // Reuse Daily's synchronous single-flight/generation fence, not React's async busy flag.
  const requests = useMemo(() => createDailyGameplayRequestController(), []);
  const [game, setGame] = useState<CustomLineupV2BrowserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [suggestions, setSuggestions] = useState<Candidate[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [admission, setAdmission] = useState<'idle'|'saving'|'saved'|'error'>('idle');

  const restore = useCallback(() => {
    // Refresh and terminal continuation supersede all older callbacks, including
    // their errors and finally handlers. Server commits remain authoritative.
    requests.invalidate();
    setLoading(true);
    setBusy(false);
    setError(null);
    setGame(null);
    setTerminal(null);
    setAdmission('idle');
    setSelected(null);
    setQuery('');
    setSuggestions([]);
    void requests.request({
      execute: () => client.bootstrap(puzzleId),
      onStart: () => {},
      onSuccess: snapshot => { setGame(snapshot); },
      onError: err => { setError(errorMessage(err)); },
      onSettled: () => { setLoading(false); },
    });
  }, [client, puzzleId, requests]);

  useEffect(() => {
    restore();
    return () => { requests.invalidate(); };
  }, [requests, restore]);

  const submitCompletion = useCallback(() => {
    void requests.request({
      execute: () => client.submit(puzzleId),
      onStart: () => { setAdmission('saving'); },
      onSuccess: () => { setAdmission('saved'); },
      onError: () => { setAdmission('error'); },
      onSettled: () => {},
    });
  }, [client, puzzleId, requests]);
  useEffect(() => {
    if (game?.attemptMode === 'completed') submitCompletion();
  }, [game?.attemptMode, submitCompletion]);

  const canSearch = !loading && game?.attemptMode === 'reserved' && terminal === null && !busy;
  useEffect(() => {
    const search = query.trim();
    if (!canSearch || selected !== null || !/[a-z]{2}/i.test(search) || search.length > 100) {
      setSuggestions([]);
      setSearchBusy(false);
      return;
    }
    const controller = new AbortController();
    setSearchBusy(true);
    const timer = setTimeout(() => {
      void fetch('/api/players/search?q=' + encodeURIComponent(search), {
        credentials: 'same-origin', signal: controller.signal,
      }).then(async response => {
        if (!response.ok) throw Error('Search unavailable');
        const payload: unknown = await response.json();
        if (payload === null || typeof payload !== 'object'
          || !('results' in payload) || !Array.isArray(payload.results)) throw Error('Invalid results');
        if (!controller.signal.aborted) {
          setSuggestions(payload.results.filter(isCandidate).slice(0, 8));
        }
      }).catch(() => {
        if (!controller.signal.aborted) setSuggestions([]);
      }).finally(() => {
        if (!controller.signal.aborted) setSearchBusy(false);
      });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [canSearch, query, selected]);

  function onFailure(err: unknown): void {
    if (err instanceof CustomLineupV2TransportError
      && (err.kind === 'conflict' || err.kind === 'completed')) {
      restore(); // A different tab may have committed an action.
    } else {
      setError(errorMessage(err));
    }
  }
  function revealHint(): void {
    if (game?.attemptMode !== 'reserved' || game.hintBundle.revealedCount >= 4 || busy) return;
    const token = game.progressionToken;
    void requests.request({
      execute: () => client.revealHint(puzzleId, token),
      onStart: () => { setBusy(true); setError(null); },
      onSuccess: revealed => {
        setGame(current => {
          if (current?.attemptMode !== 'reserved' || current.progressionToken !== token) return current;
          const slot = current.hintBundle.revealedCount + 1;
          return {
            ...current, progressionToken: revealed.progressionToken,
            hintBundle: { ...current.hintBundle, revealedCount: slot as 1|2|3|4,
              hints: [...current.hintBundle.hints, {
                slot: slot as 1|2|3|4, ...revealed.hint,
              }] },
          };
        });
      },
      onError: onFailure,
      onSettled: () => { setBusy(false); },
    });
  }
  function resolve(action: { submittedPlayerId: string } | { giveUp: true }): void {
    if (game?.attemptMode !== 'reserved' || busy || terminal !== null) return;
    const token = game.progressionToken;
    const currentPitch = game.attemptProgress.completedAtBats.length + 1;
    void requests.request({
      execute: () => client.resolve(puzzleId, token, currentPitch, game.atBats.length, action),
      onStart: () => { setBusy(true); setError(null); },
      onSuccess: outcome => {
        if (outcome.kind === 'incorrect') {
          setGame(current => current?.attemptMode === 'reserved'
            && current.progressionToken === token
            ? { ...current, progressionToken: outcome.progressionToken,
              attemptProgress: { ...current.attemptProgress, strikeCount: outcome.strikeCount } }
            : current);
          setSelected(null); setQuery(''); setSuggestions([]);
          setError('Incorrect. Try another player or reveal a clue.');
        } else {
          setTerminal(outcome);
          setSelected(null); setQuery(''); setSuggestions([]);
        }
      },
      onError: onFailure,
      onSettled: () => { setBusy(false); },
    });
  }

  const facts = game?.attemptMode === 'reserved' ? game.attemptProgress.completedAtBats
    : game?.attemptMode === 'completed' ? game.completedAtBats : [];
  const pitches = game?.atBats ?? [];
  const currentPitch = game?.attemptMode === 'reserved' ? facts.length + 1 : null;
  const finished = game?.attemptMode === 'completed';
  return (
    <main className="custom-lineup-page">
      <div className="custom-lineup-shell">
        <header className="custom-lineup-masthead">
          <a className="custom-lineup-wordmark" href="/" aria-label="Initial Baseball home">IB <span>Initial Baseball</span></a>
          <div className="custom-lineup-masthead-title">
            <span className="custom-lineup-kicker">The ballpark · Community lineups</span>
            <h1>{displayTitle ?? 'Custom Lineup'}</h1>
            <p>Recognize the players from their initials. Every clue costs points.</p>
          </div>
          <span className="custom-lineup-length">{pitches.length || '–'} batters</span>
        </header>

        {loading ? <p className="custom-lineup-status" role="status">Opening your lineup…</p> : null}
        {!loading && game === null ? (
          <section className="custom-lineup-panel" role="alert">
            <h2>Lineup unavailable</h2>
            <p>{error ?? 'This game could not be opened.'}</p>
            <button type="button" className="custom-lineup-primary" onClick={() => { void restore(); }}>
              Try again
            </button>
          </section>
        ) : null}
        {!loading && game !== null ? (
          <div className="custom-lineup-grid">
            <CustomLineupScorecard atBats={pitches} completedAtBats={facts}
              currentPitch={currentPitch} />
            {game.attemptMode === 'creator_preview' ? (
              <section className="custom-lineup-panel">
                <span className="custom-lineup-kicker">Creator preview</span>
                <h2>Your lineup is locked</h2>
                <p>This browser created the lineup. Creator plays are excluded from competitive results.</p>
              </section>
            ) : finished ? (
              <section className="custom-lineup-panel custom-lineup-finished">
                <span className="custom-lineup-kicker">Final</span>
                <h2>Lineup complete</h2>
                <p>All {pitches.length} batters are in the scorecard. Your original result is preserved on this browser.</p>
                <p aria-live="polite">{admission === 'saved' ? 'Result saved.'
                  : admission === 'saving' ? 'Saving your result…'
                    : admission === 'error' ? 'Could not save the result yet.' : 'Result complete.'}</p>
                {admission === 'error' ? <button type="button"
                  className="custom-lineup-secondary" onClick={() => { void submitCompletion(); }}>
                  Retry saving result
                </button> : null}
              </section>
            ) : terminal !== null ? (
              <CustomLineupTerminalPanel terminal={terminal} error={error}
                loading={loading} onContinue={() => { void restore(); }} />
            ) : game.attemptMode === 'reserved' ? (
              <section className="custom-lineup-panel" aria-label="Current at-bat">
                <div className="custom-lineup-active-heading">
                  <span className="custom-lineup-kicker">At bat {currentPitch} of {pitches.length}</span>
                  <span className="custom-lineup-strikes" aria-live="polite">
                    {game.attemptProgress.strikeCount} / 3 strikes
                  </span>
                </div>
                <div className="custom-lineup-big-initials" aria-label={'Player initials '+pitches[facts.length]?.initials}>
                  {pitches[facts.length]?.initials}
                </div>
                <div className="custom-lineup-clues">
                  <div className="custom-lineup-clue-header">
                    <h3>Clues</h3><span>{game.hintBundle.revealedCount} / 4</span>
                  </div>
                  {game.hintBundle.hints.length === 0
                    ? <p className="custom-lineup-muted">Know the initials? Guess without a clue for maximum points.</p>
                    : <dl>{game.hintBundle.hints.map(h => (
                      <div key={h.slot}><dt>{h.hintLabel}</dt><dd>{h.hintValue}</dd></div>
                    ))}</dl>}
                </div>
                <form onSubmit={event => {
                  event.preventDefault();
                  if (selected) void resolve({ submittedPlayerId: selected.playerId });
                }}>
                  <label className="custom-lineup-search-label" htmlFor="custom-lineup-search">Guess the player</label>
                  <div className="custom-lineup-search-field">
                    <input id="custom-lineup-search" type="search" autoComplete="off"
                      placeholder="Search by full name" value={query} disabled={busy}
                      onChange={event => {
                        if ('value' in event.target && typeof event.target.value === 'string') {
                          setQuery(event.target.value);
                          setSelected(null);
                        }
                      }} />
                    {selected !== null ? <button type="button" onClick={() => {
                      setSelected(null); setQuery(''); setSuggestions([]);
                    }}>Change</button> : null}
                  </div>
                  {suggestions.length > 0 && selected === null ? (
                    <ul className="custom-lineup-suggestions" aria-label="Matching players">
                      {suggestions.map(candidate => (
                        <li key={candidate.playerId}><button type="button" disabled={busy}
                          onClick={() => {
                            setSelected(candidate); setQuery(candidate.displayName); setSuggestions([]);
                          }}>{candidate.displayName}</button></li>
                      ))}
                    </ul>
                  ) : null}
                  {searchBusy ? <p className="custom-lineup-muted" role="status">Searching…</p> : null}
                  <div className="custom-lineup-actions">
                    <button type="submit" className="custom-lineup-primary" disabled={busy || !selected}>
                      {busy ? 'Checking…' : 'Guess player'}
                    </button>
                    <button type="button" className="custom-lineup-secondary"
                      disabled={busy || game.hintBundle.revealedCount === 4}
                      onClick={() => { void revealHint(); }}>Reveal clue</button>
                    <button type="button" className="custom-lineup-quiet" disabled={busy}
                      onClick={() => { void resolve({ giveUp: true }); }}>Give up</button>
                  </div>
                </form>
                {error ? <p className="custom-lineup-error" role="alert">{error}</p> : null}
              </section>
            ) : null}
          </div>
        ) : null}
        <footer className="custom-lineup-footer">
          <a href="/">Daily game</a>
          <span>One attempt per browser · Points-v4</span>
        </footer>
      </div>
    </main>
  );
}
