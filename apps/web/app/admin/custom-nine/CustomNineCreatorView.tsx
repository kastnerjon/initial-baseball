'use client';

import React, { useEffect, useState, type JSX } from 'react';
import {
  appendCustomNinePlayer,
  isCompleteCustomNineSelection,
  isCompleteCustomLineupSelection,
  isCustomNineDraftEditable,
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
export function CustomNineCreatorView({ mode = 'v1' }: {
  mode?: 'v1' | 'v2';
} = {}): JSX.Element {
  const isV2 = mode === 'v2';
  const maximumPlayers = isV2 ? 10 : 9;
  const creationEndpoint = isV2 ? '/api/custom-lineup/challenges' : '/api/custom-nine/challenges';
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchCandidate[]>([]);
  const [players, setPlayers] = useState<readonly ChosenCustomNinePlayer[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const draftEditable = isCustomNineDraftEditable(createdId, issuing);
  const validSelection = isV2
    ? isCompleteCustomLineupSelection(players)
    : isCompleteCustomNineSelection(players);
  const displayedSlots = isV2
    ? Math.min(maximumPlayers, players.length + 1)
    : maximumPlayers;

  useEffect(() => {
    const trimmed = query.trim();
    setSearchError(false);
    if (trimmed.length < 2 || players.length === maximumPlayers || !draftEditable) {
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
  }, [query, players.length, draftEditable, maximumPlayers]);

  function add(candidate: SearchCandidate): void {
    if (!draftEditable) return;
    setPlayers(current => appendCustomNinePlayer(current, {
      playerId: candidate.playerId,
      displayName: candidate.displayName,
      label: playerLabel(candidate),
    }, maximumPlayers));
    setQuery('');
    setSuggestions([]);
    setIssueError(null);
  }

  async function issue(): Promise<void> {
    if (!draftEditable || !validSelection) return;
    setIssuing(true);
    setIssueError(null);
    setCopyMessage(null);
    try {
      const response = await fetch(creationEndpoint, {
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
            ? isV2 ? 'Choose 1–10 distinct players and try again.' : 'The nine-player selection is invalid. Verify all slots and try again.'
            : 'Challenge could not be issued. Try again later.');
        return;
      }
      const value: unknown = await response.json();
      if (value === null || typeof value !== 'object'
        || !('puzzleId' in value) || typeof value.puzzleId !== 'string'
        || !(isV2
          ? /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.puzzleId)
          : /^custom-nine-v1-[a-f0-9-]{36}$/.test(value.puzzleId))) {
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
        <p className="eyebrow">Authorized operations · {isV2 ? 'Custom Lineup v2' : 'Staged Custom Nine'}</p>
        <h1>{isV2 ? 'Create a Custom Lineup' : 'Create a Custom Nine'}</h1>
        <p>{isV2
          ? 'Choose 1–10 different canonical players in batting order. Players and clues are frozen when issued.'
          : 'Select exactly nine different canonical players in batting order. Players and their clues are frozen when you issue the challenge.'}</p>
        <p><a href="/admin/daily">Back to Daily administration</a></p>
        <p><a href={isV2 ? '/admin/custom-nine' : '/admin/custom-lineup'}>
          {isV2 ? 'Legacy Custom Nine creator' : 'Custom Lineup 1–10 creator'}
        </a></p>
      </header>
      <section className="custom-nine-creator-card" aria-labelledby="custom-nine-lineup-heading">
        <div className="custom-nine-creator-heading">
          <h2 id="custom-nine-lineup-heading">Your lineup</h2>
          <span>{players.length} / {maximumPlayers} chosen</span>
        </div>
        <ol className="custom-nine-creator-players">
          {Array.from({ length: displayedSlots }, (_, index) => {
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
                        disabled={index === 0 || !draftEditable}
                        onClick={() => { setPlayers(current => moveCustomNinePlayer(current, index, -1)); }}>↑</button>
                      <button type="button" aria-label={'Move ' + player.displayName + ' down'}
                        disabled={index === players.length - 1 || !draftEditable}
                        onClick={() => { setPlayers(current => moveCustomNinePlayer(current, index, 1)); }}>↓</button>
                      <button type="button" aria-label={'Remove ' + player.displayName}
                        disabled={!draftEditable}
                        onClick={() => { setPlayers(current => removeCustomNinePlayer(current, player.playerId)); }}>Remove</button>
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
            disabled={players.length === maximumPlayers || !draftEditable}
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
                    disabled={players.some(player => player.playerId === candidate.playerId) || !draftEditable}
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
          <button type="button" disabled={!validSelection || !draftEditable}
            onClick={() => { void issue(); }}>
            {issuing ? 'Issuing challenge…' : 'Issue immutable challenge'}
          </button>
          <p>Admin-only staging. Issuing does not activate public competitive participation.</p>
          {issueError !== null ? <p role="alert">{issueError}</p> : null}
          {createdId !== null ? (
            <div className="custom-nine-created" role="status">
              <strong>Challenge issued.</strong>
              <p>{isV2 ? 'This challenge is issued privately. Gameplay links remain disabled until a separately approved release.' : 'The opaque challenge ID is ready. Playable challenge links are a separate upcoming stage.'}</p>
              <code>{createdId}</code>
              <button type="button" onClick={() => { void copyId(); }}>Copy challenge ID</button>
              {copyMessage !== null ? <span>{copyMessage}</span> : null}
              <p>Save or copy this ID before starting another challenge. Your issued lineup is locked.</p>
              <button type="button" onClick={() => {
                setPlayers([]);
                setQuery('');
                setSuggestions([]);
                setCreatedId(null);
                setIssueError(null);
                setCopyMessage(null);
              }}>Start another challenge</button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
