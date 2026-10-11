'use client';

import React, { useEffect, useState, type JSX } from 'react';
import {
  appendCustomNinePlayer,
  isCompleteCustomNineSelection,
  moveCustomNinePlayer,
  removeCustomNinePlayer,
  type ChosenCustomNinePlayer,
} from './customNineCreatorSelection';

type SearchCandidate = {
  playerId: string;
  displayName: string;
  metadata?: { firstYear?: number | null; lastYear?: number | null; primaryPosition?: string };
};

function isCandidate(value: unknown): value is SearchCandidate {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.playerId === 'string' && candidate.playerId.length > 0
    && typeof candidate.displayName === 'string' && candidate.displayName.trim().length > 0;
}

function playerLabel(player: SearchCandidate): string {
  const first = player.metadata?.firstYear;
  const last = player.metadata?.lastYear;
  const years = typeof first === 'number' && typeof last === 'number'
    ? ' · ' + first + '–' + last : '';
  return player.displayName + years;
}

/** Admin-only staging view. Public creation requires separate abuse controls. */
export function CustomNineCreatorView(): JSX.Element {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchCandidate[]>([]);
  const [players, setPlayers] = useState<readonly ChosenCustomNinePlayer[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    setSearchError(false);
    if (trimmed.length < 2 || players.length === 9) {
      setSuggestions([]);
      setSearchBusy(false);
      return;
    }
    const controller = new AbortController();
    setSearchBusy(true);
    const timer = setTimeout(() => {
      void fetch('/api/players/search?q=' + encodeURIComponent(trimmed), {
        credentials: 'same-origin', signal: controller.signal,
      }).then(async response => {
        if (!response.ok) throw new Error('search unavailable');
        const value: unknown = await response.json();
        if (value === null || typeof value !== 'object'
          || !('results' in value) || !Array.isArray(value.results)) {
          throw new Error('invalid search response');
        }
        if (!controller.signal.aborted) setSuggestions(value.results.filter(isCandidate).slice(0, 12));
      }).catch(() => {
        if (!controller.signal.aborted) { setSuggestions([]); setSearchError(true); }
      }).finally(() => {
        if (!controller.signal.aborted) setSearchBusy(false);
      });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, players.length]);

  function add(candidate: SearchCandidate): void {
    setPlayers(current => appendCustomNinePlayer(current, {
      playerId: candidate.playerId,
      displayName: candidate.displayName,
      label: playerLabel(candidate),
    }));
    setQuery('');
    setSuggestions([]);
    setCreatedId(null);
    setIssueError(null);
  }

  async function issue(): Promise<void> {
    if (issuing || !isCompleteCustomNineSelection(players)) return;
    setIssuing(true);
    setIssueError(null);
    setCreatedId(null);
    setCopyMessage(null);
    try {
      const response = await fetch('/api/custom-nine/challenges', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ canonicalPlayerIds: players.map(player => player.playerId) }),
      });
      if (response.status === 401) {
        setIssueError('Administrator authorization is required. Sign in to the admin dashboard again.');
        return;
      }
      if (!response.ok) {
        setIssueError(response.status === 422
          ? 'At least one player does not have the required four-hint game data. Replace that player.'
          : response.status === 400
            ? 'The nine-player selection is invalid. Verify all slots and try again.'
            : 'Challenge could not be issued. Try again later.');
        return;
      }
      const value: unknown = await response.json();
      if (value === null || typeof value !== 'object'
        || !('puzzleId' in value) || typeof value.puzzleId !== 'string'
        || !/^custom-nine-v1-[a-f0-9-]{36}$/.test(value.puzzleId)) {
        throw new Error('Invalid issue response');
      }
      setCreatedId(value.puzzleId);
    } catch {
      setIssueError('Challenge could not be issued. Try again later.');
    } finally {
      setIssuing(false);
    }
  }

  async function copyId(): Promise<void> {
    if (createdId === null) return;
    try {
      const clipboard = (navigator as Navigator & { clipboard?: { writeText: (text: string) => Promise<void> } }).clipboard;
      if (!clipboard) throw new Error('Clipboard unavailable');
      await clipboard.writeText(createdId);
      setCopyMessage('Challenge ID copied.');
    } catch {
      setCopyMessage('Could not copy automatically. Select the challenge ID below.');
    }
  }

  return (
    <main className="custom-nine-creator">
      <header>
        <p className="eyebrow">Authorized operations · Staged Custom Nine</p>
        <h1>Create a Custom Nine</h1>
        <p>Select exactly nine different canonical players in batting order. Players and their clues are frozen when you issue the challenge.</p>
        <p><a href="/admin/daily">Back to Daily administration</a></p>
      </header>
      <section className="custom-nine-creator-card" aria-labelledby="custom-nine-lineup-heading">
        <div className="custom-nine-creator-heading">
          <h2 id="custom-nine-lineup-heading">Your lineup</h2>
          <span>{players.length} / 9 chosen</span>
        </div>
        <ol className="custom-nine-creator-players">
          {Array.from({ length: 9 }, (_, index) => {
            const player = players[index];
            return (
              <li key={player?.playerId ?? 'empty-' + index}>
                <span className="custom-nine-slot-number">{index + 1}</span>
                {player === undefined ? (
                  <span className="custom-nine-slot-empty">Choose a player</span>
                ) : (
                  <>
                    <span className="custom-nine-player-name">{player.label}</span>
                    <div className="custom-nine-slot-actions">
                      <button type="button" aria-label={'Move ' + player.displayName + ' up'}
                        disabled={index === 0 || issuing}
                        onClick={() => { setPlayers(current => moveCustomNinePlayer(current, index, -1)); setCreatedId(null); }}>↑</button>
                      <button type="button" aria-label={'Move ' + player.displayName + ' down'}
                        disabled={index === players.length - 1 || issuing}
                        onClick={() => { setPlayers(current => moveCustomNinePlayer(current, index, 1)); setCreatedId(null); }}>↓</button>
                      <button type="button" aria-label={'Remove ' + player.displayName}
                        disabled={issuing}
                        onClick={() => { setPlayers(current => removeCustomNinePlayer(current, player.playerId)); setCreatedId(null); }}>Remove</button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ol>
        <div className="custom-nine-search">
          <label htmlFor="custom-nine-player-search">Find a player</label>
          <input id="custom-nine-player-search" type="search" autoComplete="off"
            placeholder="Search a player by name" value={query}
            disabled={players.length === 9 || issuing}
            onChange={event => {
              if ('value' in event.target && typeof event.target.value === 'string') setQuery(event.target.value);
            }} />
          {searchBusy ? <p role="status">Searching…</p> : null}
          {searchError ? <p role="status">Player search unavailable. Try again.</p> : null}
          {query.trim().length >= 2 && !searchBusy && !searchError && suggestions.length === 0
            ? <p>No matches. Try a full name.</p> : null}
          {suggestions.length > 0 && !searchBusy ? (
            <ul aria-label="Matching canonical players">
              {suggestions.map(candidate => (
                <li key={candidate.playerId}>
                  <button type="button"
                    disabled={players.some(player => player.playerId === candidate.playerId) || issuing}
                    onClick={() => add(candidate)}>
                    <span>{playerLabel(candidate)}</span>
                    <span>{players.some(player => player.playerId === candidate.playerId) ? 'Added' : 'Add'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="custom-nine-create-action">
          <button type="button" disabled={!isCompleteCustomNineSelection(players) || issuing}
            onClick={() => { void issue(); }}>
            {issuing ? 'Issuing challenge…' : 'Issue immutable challenge'}
          </button>
          <p>Admin-only staging. Issuing does not activate public competitive participation.</p>
          {issueError !== null ? <p role="alert">{issueError}</p> : null}
          {createdId !== null ? (
            <div className="custom-nine-created" role="status">
              <strong>Challenge issued.</strong>
              <p>The opaque challenge ID is ready. Playable challenge links are a separate upcoming stage.</p>
              <code>{createdId}</code>
              <button type="button" onClick={() => { void copyId(); }}>Copy challenge ID</button>
              {copyMessage !== null ? <span>{copyMessage}</span> : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
