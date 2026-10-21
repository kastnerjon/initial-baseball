'use client';

import React, { useEffect, useState, type Dispatch, type JSX, type SetStateAction } from 'react';
import {
  chooseCustomLineupSlot, resizeCustomLineupSlots, swapCustomLineupSlots,
  type ChosenCustomNinePlayer, type CustomLineupSlots,
} from './customNineCreatorSelection';

type Candidate = {
  playerId: string;
  displayName: string;
  metadata?: { firstYear?: number | null; lastYear?: number | null; teamsDisplay?: string };
};

function isCandidate(value: unknown): value is Candidate {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.playerId === 'string' && item.playerId.length > 0
    && typeof item.displayName === 'string' && item.displayName.trim().length > 0;
}

function yearLabel(candidate: Candidate): string {
  const { firstYear, lastYear } = candidate.metadata ?? {};
  return typeof firstYear === 'number' && typeof lastYear === 'number'
    ? firstYear + '–' + lastYear : '';
}

/** Canonical search is provided by the existing game endpoint/engine, not the creator UI. */
export function CustomLineupSlotPicker({ slots, setSlots, editable, creatorEligibleSearch = false }: {
  slots: CustomLineupSlots;
  setSlots: Dispatch<SetStateAction<CustomLineupSlots>>;
  editable: boolean;
  creatorEligibleSearch?: boolean;
}): JSX.Element {
  const [editing, setEditing] = useState<number | null>(null);
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    setError(false);
    if (editing === null || !editable || trimmed.length < 2 || trimmed.length > 100) {
      setResults([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      const endpoint = creatorEligibleSearch
        ? '/api/players/creator-search?q=' : '/api/players/search?q=';
      void fetch(endpoint + encodeURIComponent(trimmed), {
        credentials: 'same-origin', signal: controller.signal,
      }).then(async response => {
        if (!response.ok) throw new Error('search unavailable');
        const payload: unknown = await response.json();
        if (payload === null || typeof payload !== 'object'
          || !('results' in payload) || !Array.isArray(payload.results)) {
          throw new Error('invalid response');
        }
        if (!controller.signal.aborted) setResults(payload.results.filter(isCandidate).slice(0, 10));
      }).catch(() => {
        if (!controller.signal.aborted) { setResults([]); setError(true); }
      }).finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, editing, editable, creatorEligibleSearch]);

  function cancelSearch(): void {
    setEditing(null);
    setQuery('');
    setResults([]);
  }

  function pressSlot(index: number): void {
    if (!editable) return;
    if (swapFrom !== null) {
      setSlots(current => swapCustomLineupSlots(current, swapFrom, index));
      setSwapFrom(null);
      return;
    }
    setEditing(index);
    setQuery('');
    setResults([]);
  }

  function selectPlayer(candidate: Candidate): void {
    if (editing === null || !editable) return;
    const label = [candidate.displayName, yearLabel(candidate)].filter(Boolean).join(' · ');
    setSlots(current => chooseCustomLineupSlot(current, editing, {
      playerId: candidate.playerId, displayName: candidate.displayName, label,
    }));
    cancelSearch();
  }

  return (
    <div className="custom-lineup-slot-picker">
      <div className="custom-lineup-length">
        <label htmlFor="custom-lineup-length">Number of players</label>
        <select id="custom-lineup-length" value={slots.length} disabled={!editable}
          onChange={event => {
            if ('value' in event.target && typeof event.target.value === 'string') {
              const chosenLength = Number(event.target.value);
              setSlots(current => resizeCustomLineupSlots(current, chosenLength));
              cancelSearch();
              setSwapFrom(null);
            }
          }}>
          {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
      </div>
      <p className="custom-lineup-slot-help">Search each spot to choose a player. Use Swap to exchange two spots.</p>
      {swapFrom !== null ? (
        <div className="custom-lineup-swap-notice" role="status">
          Choose another spot to swap with #{swapFrom + 1}.
          <button type="button" onClick={() => setSwapFrom(null)}>Cancel swap</button>
        </div>
      ) : null}
      <ol className="custom-lineup-slots">
        {slots.map((player, index) => (
          <li key={index} className={swapFrom === index ? 'custom-lineup-swap-source' : ''}>
            <span className="custom-nine-slot-number">{index + 1}.</span>
            <div className="custom-lineup-slot-main">
              {editing === index && editable ? (
                <div className="custom-lineup-slot-search">
                  <input type="search" autoComplete="off" autoFocus maxLength={100}
                    aria-label={'Search player for slot ' + (index + 1)}
                    placeholder="Search player name" value={query}
                    onChange={event => {
                      if ('value' in event.target && typeof event.target.value === 'string') {
                        setQuery(event.target.value); setResults([]);
                      }
                    }}
                    onKeyDown={event => { if (event.key === 'Escape') cancelSearch(); }} />
                  {busy ? <p role="status">Searching…</p> : null}
                  {error ? <p role="status">Player search unavailable. Try again.</p> : null}
                  {query.trim().length >= 2 && !busy && !error && results.length === 0
                    ? <p>No matches. Try another name.</p> : null}
                  {results.length > 0 && !busy ? (
                    <ul aria-label={'Matching players for slot ' + (index + 1)}>
                      {results.map(candidate => {
                        const alreadyChosen = slots.some((existing, i) =>
                          i !== index && existing?.playerId === candidate.playerId);
                        return (
                          <li key={candidate.playerId}>
                            <button type="button" disabled={alreadyChosen}
                              onClick={() => selectPlayer(candidate)}>
                              <strong>{candidate.displayName}</strong>
                              {yearLabel(candidate) ? <span>{yearLabel(candidate)}</span> : null}
                              {candidate.metadata?.teamsDisplay
                                ? <span>Teams: {candidate.metadata.teamsDisplay}</span> : null}
                              {alreadyChosen ? <small>Already selected</small> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <button type="button" className="custom-lineup-cancel" onClick={cancelSearch}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="custom-lineup-select-slot" disabled={!editable}
                  aria-label={swapFrom !== null
                    ? 'Swap slot ' + (swapFrom + 1) + ' with slot ' + (index + 1)
                    : player ? 'Change player in slot ' + (index + 1) : 'Choose player for slot ' + (index + 1)}
                  onClick={() => pressSlot(index)}>
                  {player ? player.label : <span className="custom-nine-slot-empty">Search for a player…</span>}
                  {swapFrom !== null && index !== swapFrom ? <small>Swap here</small> : null}
                </button>
              )}
            </div>
            {player && editable && swapFrom === null && editing !== index ? (
              <button type="button" className="custom-lineup-swap" 
                aria-label={'Swap ' + player.displayName + ' from slot ' + (index + 1)}
                onClick={() => { cancelSearch(); setSwapFrom(index); }}>
                ↔ <span>Swap</span>
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
