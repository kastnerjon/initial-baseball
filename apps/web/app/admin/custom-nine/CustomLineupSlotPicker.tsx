'use client';

import React, { useEffect, useState, type JSX } from 'react';
import type { ChosenCustomNinePlayer } from './customNineCreatorSelection';
import {
  chooseCustomLineupSlot, resizeCustomLineupSlots, swapCustomLineupSlots,
  type CustomLineupSlot,
} from './customLineupSlots';

type Candidate = {
  playerId: string;
  displayName: string;
  metadata?: {
    firstYear?: number | null;
    lastYear?: number | null;
    teamsDisplay?: string;
  };
};

function isCandidate(value: unknown): value is Candidate {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && typeof (value as Candidate).playerId === 'string'
    && typeof (value as Candidate).displayName === 'string';
}

function years(candidate: Candidate): string | null {
  const first = candidate.metadata?.firstYear;
  const last = candidate.metadata?.lastYear;
  return typeof first === 'number' && typeof last === 'number'
    ? first === last ? String(first) : first + '–' + last : null;
}

/** V2 only. Uses gameplay's canonical search endpoint; slot order is the issued order. */
export function CustomLineupSlotPicker({ slots, onChange, editable }: {
  slots: readonly CustomLineupSlot[];
  onChange: (slots: readonly CustomLineupSlot[]) => void;
  editable: boolean;
}): JSX.Element {
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    setSearchError(false);
    if (activeSlot === null || !editable || trimmed.length < 2 || trimmed.length > 100) {
      setSuggestions([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const timer = setTimeout(() => {
      void fetch('/api/players/search?q=' + encodeURIComponent(trimmed), {
        credentials: 'same-origin', signal: controller.signal,
      }).then(async response => {
        if (!response.ok) throw new Error('Search unavailable');
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('results' in result)
          || !Array.isArray(result.results)) throw new Error('Invalid search response');
        if (!controller.signal.aborted) setSuggestions(result.results.filter(isCandidate).slice(0, 10));
      }).catch(() => {
        if (!controller.signal.aborted) { setSuggestions([]); setSearchError(true); }
      }).finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [activeSlot, query, editable]);

  function activate(index: number): void {
    if (!editable || swapFrom !== null) return;
    setActiveSlot(index);
    setQuery('');
    setSuggestions([]);
  }

  function select(candidate: Candidate, index: number): void {
    if (!editable || slots.some((slot, i) => i !== index && slot?.playerId === candidate.playerId)) return;
    const selected: ChosenCustomNinePlayer = {
      playerId: candidate.playerId,
      displayName: candidate.displayName,
      label: candidate.displayName + (years(candidate) ? ' · ' + years(candidate) : ''),
    };
    onChange(chooseCustomLineupSlot(slots, index, selected));
    setActiveSlot(null);
    setQuery('');
    setSuggestions([]);
  }

  return (
    <div className="custom-lineup-slot-picker">
      <div className="custom-lineup-count-control">
        <label htmlFor="custom-lineup-player-count">Number of players</label>
        <select id="custom-lineup-player-count" value={slots.length} disabled={!editable}
          onChange={event => {
            if ('value' in event.target) onChange(resizeCustomLineupSlots(slots, Number(event.target.value)));
            setActiveSlot(null);
            setSwapFrom(null);
            setQuery('');
          }}>
          {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
      </div>
      <p className="custom-lineup-slot-instructions">
        Search in each numbered slot. To reorder, tap Swap, then choose another filled slot.
        Reducing the number of players removes any players in the cut slots.
      </p>
      {swapFrom !== null && (
        <p className="custom-lineup-swap-status" role="status">
          Swapping #{swapFrom + 1} ({slots[swapFrom]?.displayName}). Choose another filled slot or cancel.
          {' '}<button type="button" onClick={() => setSwapFrom(null)}>Cancel swap</button>
        </p>
      )}
      <ol className="custom-lineup-slots">
        {slots.map((player, index) => {
          const searching = activeSlot === index && swapFrom === null;
          const existing = player !== null && !searching;
          return (
            <li key={index} className={swapFrom === index ? 'custom-lineup-slot swap-source' : 'custom-lineup-slot'}>
              <span className="custom-nine-slot-number" aria-hidden="true">{index + 1}.</span>
              <div className="custom-lineup-slot-content">
                {existing ? (
                  <div className="custom-lineup-chosen">
                    <span className="custom-nine-player-name">{player.label}</span>
                    {editable && (swapFrom === null ? (
                      <div className="custom-lineup-slot-actions">
                        <button type="button" onClick={() => activate(index)}
                          aria-label={'Change player in slot ' + (index + 1)}>Change</button>
                        <button type="button" onClick={() => { setActiveSlot(null); setQuery(''); setSwapFrom(index); }}
                          aria-label={'Swap player in slot ' + (index + 1)}>Swap</button>
                      </div>
                    ) : swapFrom !== index ? (
                      <button type="button" className="custom-lineup-swap-target"
                        aria-label={'Swap slot ' + (swapFrom + 1) + ' with slot ' + (index + 1)}
                        onClick={() => { onChange(swapCustomLineupSlots(slots, swapFrom, index)); setSwapFrom(null); }}>
                        Swap here
                      </button>
                    ) : null)}
                  </div>
                ) : (
                  <div className="custom-lineup-slot-search">
                    <label className="custom-lineup-visually-hidden" htmlFor={'custom-lineup-slot-' + index}>
                      Search player for slot {index + 1}
                    </label>
                    <div className="custom-lineup-search-input-row">
                      <input id={'custom-lineup-slot-' + index} type="search" autoComplete="off"
                        placeholder="Search for a player…" disabled={!editable || swapFrom !== null}
                        maxLength={100} value={searching ? query : ''}
                        onFocus={() => { if (activeSlot !== index) activate(index); }}
                        onChange={event => { if ('value' in event.target && typeof event.target.value === 'string') { setActiveSlot(index); setQuery(event.target.value); } }}
                        aria-controls={searching && suggestions.length ? 'custom-lineup-results-' + index : undefined}
                        aria-expanded={searching && suggestions.length > 0} />
                      {player && searching && <button type="button" onClick={() => { setActiveSlot(null); setQuery(''); }}>
                        Cancel
                      </button>}
                    </div>
                    {searching && busy && <p role="status">Searching…</p>}
                    {searching && searchError && <p role="status">Player search unavailable. Try again.</p>}
                    {searching && !busy && !searchError && query.trim().length >= 2 && !suggestions.length
                      && <p>No matches. Try a full name.</p>}
                    {searching && !busy && suggestions.length > 0 && (
                      <ul id={'custom-lineup-results-' + index} aria-label={'Matching players for slot ' + (index + 1)}>
                        {suggestions.map(candidate => {
                          const added = slots.some((slot, i) => i !== index && slot?.playerId === candidate.playerId);
                          return <li key={candidate.playerId}>
                            <button type="button" disabled={added || !editable} onClick={() => select(candidate, index)}>
                              <strong>{candidate.displayName}</strong>
                              <small>{[years(candidate), candidate.metadata?.teamsDisplay].filter(Boolean).join(' · ')
                                || 'Career details unavailable'}{added ? ' · Already selected' : ''}</small>
                            </button>
                          </li>;
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
