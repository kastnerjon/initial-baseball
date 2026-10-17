'use client';

import React, { useEffect, useState, type JSX } from 'react';
import {
  appendCustomNinePlayer, moveCustomNinePlayer, removeCustomNinePlayer,
  type ChosenCustomNinePlayer,
} from '../custom-nine/customNineCreatorSelection';

type Candidate = {
  playerId: string;
  displayName: string;
  metadata?: { firstYear?: number | null; lastYear?: number | null };
};

function isCandidate(value: unknown): value is Candidate {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.playerId === 'string' && candidate.playerId.length > 0
    && typeof candidate.displayName === 'string' && candidate.displayName.trim().length > 0;
}

export function DailyFiveDraftWorkbench({ writesEnabled = false }: {
  writesEnabled?: boolean;
}): JSX.Element {
  const [date, setDate] = useState('');
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<readonly ChosenCustomNinePlayer[]>([]);
  const [suggestions, setSuggestions] = useState<readonly Candidate[]>([]);
  const [searchError, setSearchError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const complete = players.length === 5 && !!date;
  const editable = !saving && savedId === null;

  async function saveDraft(): Promise<void> {
    if (!writesEnabled || !complete || !editable) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch('/admin/daily-five/drafts', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          puzzleDate: date, canonicalPlayerIds: players.map(player => player.playerId),
        }),
      });
      if (!response.ok) {
        setSaveError(response.status === 409
          ? 'Draft writes are disabled or a puzzle already exists for this date.'
          : response.status === 400 ? 'Invalid date or selections.'
            : response.status === 401 ? 'Administrator authorization required.'
              : 'Draft could not be saved.');
        return;
      }
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || !('draftId' in value)
        || typeof value.draftId !== 'string' || value.draftId.length === 0) {
        throw new Error('Invalid draft response');
      }
      setSavedId(value.draftId);
    } catch {
      setSaveError('Draft could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.length > 100 || players.length === 5) {
      setSuggestions([]);
      setSearchError(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch('/api/players/search?q=' + encodeURIComponent(trimmed), {
        signal: controller.signal, credentials: 'same-origin',
      }).then(async response => {
        if (!response.ok) throw new Error('search unavailable');
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object' || !('results' in body)
          || !Array.isArray(body.results)) throw new Error('invalid search results');
        if (!controller.signal.aborted) {
          setSuggestions(body.results.filter(isCandidate).slice(0, 12));
          setSearchError(false);
        }
      }).catch(() => {
        if (!controller.signal.aborted) { setSuggestions([]); setSearchError(true); }
      });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, players.length]);

  function add(candidate: Candidate): void {
    const years = candidate.metadata?.firstYear && candidate.metadata?.lastYear
      ? ' · ' + candidate.metadata.firstYear + '–' + candidate.metadata.lastYear : '';
    setPlayers(current => appendCustomNinePlayer(current, {
      playerId: candidate.playerId, displayName: candidate.displayName,
      label: candidate.displayName + years,
    }, 5));
    setQuery('');
    setSuggestions([]);
  }

  return <main className="custom-nine-creator">
    <header>
      <p className="eyebrow">Authorized operations · future Daily Five</p>
      <h1>Daily Five editorial drafts</h1>
      <p>Assemble five ordered canonical players for a future Daily. This preview does not schedule or publish anything.</p>
      <p><a href="/admin/daily">Back to Daily Nine administration</a></p>
    </header>
    <section className="custom-nine-creator-card" aria-labelledby="daily-five-heading">
      <h2 id="daily-five-heading">Draft lineup ({players.length}/5)</h2>
      <label htmlFor="five-puzzle-date">Target puzzle date</label>
      <input type="date" id="five-puzzle-date" value={date} disabled={!editable}
        onChange={event => { if ('value' in event.target && typeof event.target.value === 'string') setDate(event.target.value); }} />
      <ol className="custom-nine-creator-players">
        {Array.from({ length: 5 }, (_, index) => {
          const player = players[index];
          return <li key={player?.playerId ?? 'empty-' + index}>
            <span className="custom-nine-slot-number">{index + 1}</span>
            {player ? <>
              <span className="custom-nine-player-name">{player.label}</span>
              <div className="custom-nine-slot-actions">
                <button type="button" disabled={!editable || index === 0}
                  aria-label={'Move ' + player.displayName + ' up'}
                  onClick={() => setPlayers(current => moveCustomNinePlayer(current, index, -1))}>↑</button>
                <button type="button" disabled={!editable || index === players.length - 1}
                  aria-label={'Move ' + player.displayName + ' down'}
                  onClick={() => setPlayers(current => moveCustomNinePlayer(current, index, 1))}>↓</button>
                <button type="button" disabled={!editable} aria-label={'Remove ' + player.displayName}
                  onClick={() => setPlayers(current => removeCustomNinePlayer(current, player.playerId))}>Remove</button>
              </div>
            </> : <span className="custom-nine-slot-empty">Unselected</span>}
          </li>;
        })}
      </ol>
      {players.length < 5 && editable ? <div>
        <label htmlFor="five-player-search">Find canonical player</label>
        <input id="five-player-search" type="search" maxLength={100}
          value={query} onChange={event => { if ('value' in event.target && typeof event.target.value === 'string') setQuery(event.target.value); }}
          placeholder="Search by name" autoComplete="off" />
        {searchError ? <p role="alert">Player search unavailable.</p> : null}
        {suggestions.length > 0 ? <ul aria-label="Player search results">
          {suggestions.map(candidate => <li key={candidate.playerId}>
            <button type="button" disabled={players.some(p => p.playerId === candidate.playerId)}
              onClick={() => add(candidate)}>
              {candidate.displayName} ({candidate.playerId})
            </button>
          </li>)}
        </ul> : null}
      </div> : null}
      <p role="status">{savedId
        ? 'Saved five-player editorial draft: ' + savedId + '. Not scheduled or published.'
        : !writesEnabled
          ? 'Staged editor only. Saving remains disabled until calendar cutover and historical compatibility are approved.'
          : complete ? 'Draft is complete. Saving will not schedule or publish it.'
            : 'Choose a date and five distinct players.'}</p>
      {saveError ? <p role="alert">{saveError}</p> : null}
      <button type="button" disabled={!writesEnabled || !complete || !editable}
        onClick={() => { void saveDraft(); }}>
        {saving ? 'Saving…' : !writesEnabled
          ? 'Save five-player draft — unavailable during staging'
          : 'Save five-player draft'}
      </button>
    </section>
  </main>;
}
