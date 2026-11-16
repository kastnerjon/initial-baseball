'use client';

import React, { useState, type FormEvent, type JSX } from 'react';

type Candidate = {
  canonicalPlayerId: string; displayName: string; yearsPlayedDisplay: string;
  requiresYearDisambiguation: boolean; primaryPosition: string; revealReady: boolean;
};

function isCandidate(value: unknown): value is Candidate {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.canonicalPlayerId === 'string' && item.canonicalPlayerId.length > 0
    && item.canonicalPlayerId.length <= 200
    && typeof item.displayName === 'string' && typeof item.yearsPlayedDisplay === 'string'
    && typeof item.primaryPosition === 'string' && typeof item.revealReady === 'boolean'
    && typeof item.requiresYearDisambiguation === 'boolean';
}

/** Keeps private search and selected candidates out of navigation URLs and browser history. */
export default function PrivatePlayerLookup({ onSelect, onQueryChange }: {
  onSelect?: (candidate: Candidate) => void;
  onQueryChange?: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ results: Candidate[]; hasMore: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(false); setResult(null);
    try {
      const init: RequestInit & { cache: 'no-store'; referrerPolicy: 'no-referrer' } = {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ q: query }),
      };
      const response = await fetch('/admin/daily/editions/players/search', init);
      if (!response.ok) throw new Error('lookup unavailable');
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || !('results' in value)
          || !Array.isArray(value.results) || !('hasMore' in value)
          || value.results.length > 25 || !value.results.every(isCandidate)
          || typeof value.hasMore !== 'boolean') throw new Error('invalid response');
      setResult({ results: value.results, hasMore: value.hasMore });
    } catch { setError(true); }
    finally { setBusy(false); }
  }

  return <section aria-label="Private player lookup">
    <form onSubmit={search}>
      <label htmlFor="private-player-query">Player name or alias</label>
      <input id="private-player-query" type="search" maxLength={80} minLength={2}
        value={query} disabled={busy} onChange={event => {
          setResult(null); setError(false); onQueryChange?.();
          setQuery((event.target as unknown as { value: string }).value);
        }} required />
      <button type="submit" disabled={busy}>{busy ? 'Searching…' : 'Find players'}</button>
    </form>
    {error ? <p role="alert">Player search is temporarily unavailable.</p> : null}
    {result ? <section aria-label="Canonical player search results" aria-live="polite">
      <h2>Matching candidates</h2>
      {result.results.length === 0 ? <p>No matching Daily candidates.</p> : null}
      {result.hasMore ? <p>Showing the first 25 matches. Refine the search to find a specific player.</p> : null}
      <ol>{result.results.map(player => <li key={player.canonicalPlayerId}>
        <strong>{player.displayName}</strong>{player.requiresYearDisambiguation
          ? ' (' + player.yearsPlayedDisplay + ')' : ''}{' · '}{player.primaryPosition}{' · '}
        {player.revealReady ? 'Clue-ready' : 'Clue material unavailable'}
        <div><code>{player.canonicalPlayerId}</code></div>
        {onSelect && player.revealReady ? <button type="button" onClick={() => onSelect(player)}>
          Use this player</button> : null}
      </li>)}</ol>
    </section> : null}
  </section>;
}
