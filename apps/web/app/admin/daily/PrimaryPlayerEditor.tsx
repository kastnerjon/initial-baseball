'use client';

import React, { useRef, useState, type FormEvent, type JSX } from 'react';
import type { DailyAdminPlayerSearchResult } from '../../dailyAdminWorkflow';

type Preview = {
  canonicalPlayerId: string; displayName: string; initials: string; playerType: string;
  firstSeason: number; lastSeason: number; position: string; teams: string;
  careerLines: string[]; seasonCount: number; hints: { hintLabel: string; hintValue: string }[];
};

function isCandidate(value: unknown): value is DailyAdminPlayerSearchResult {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.canonicalPlayerId === 'string' && item.canonicalPlayerId.length > 0
    && typeof item.displayName === 'string' && typeof item.yearsPlayedDisplay === 'string'
    && typeof item.requiresYearDisambiguation === 'boolean' && typeof item.playerType === 'string'
    && typeof item.primaryPosition === 'string' && typeof item.teamsDisplay === 'string'
    && (item.recognizabilityRank === null || typeof item.recognizabilityRank === 'number');
}

function isPreview(value: unknown, id: string): value is Preview {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return item.canonicalPlayerId === id && typeof item.displayName === 'string'
    && typeof item.initials === 'string' && typeof item.playerType === 'string'
    && typeof item.firstSeason === 'number' && typeof item.lastSeason === 'number'
    && typeof item.position === 'string' && typeof item.teams === 'string'
    && Array.isArray(item.careerLines) && item.careerLines.every(line => typeof line === 'string')
    && typeof item.seasonCount === 'number' && Array.isArray(item.hints)
    && item.hints.every(hint => hint && typeof hint.hintLabel === 'string' && typeof hint.hintValue === 'string');
}

async function lookup(fields: Record<string, string>): Promise<unknown> {
  const init: RequestInit & { cache: 'no-store'; referrerPolicy: 'no-referrer' } = {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer',
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields),
  };
  const response = await fetch('/admin/daily/players', init);
  if (!response.ok) throw new Error('unavailable');
  return response.json();
}

/** Selection and preview remain in memory; only the explicit replacement form mutates. */
export default function PrimaryPlayerEditor({ puzzleDate, slot }: { puzzleDate: string; slot: number }): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DailyAdminPlayerSearchResult[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const generation = useRef(0);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const request = ++generation.current;
    setBusy(true); setError(false); setResults(null); setPreview(null);
    try {
      const value = await lookup({ q: query }) as { results?: unknown; hasMore?: unknown };
      if (!value || !Array.isArray(value.results) || value.results.length > 25 || !value.results.every(isCandidate) || typeof value.hasMore !== 'boolean') throw new Error('invalid');
      if (request === generation.current) { setResults(value.results as DailyAdminPlayerSearchResult[]); setHasMore(value.hasMore); }
    } catch { if (request === generation.current) setError(true); }
    finally { if (request === generation.current) setBusy(false); }
  }

  async function select(playerId: string) {
    if (busy) return;
    const request = ++generation.current;
    setBusy(true); setError(false); setPreview(null);
    try {
      const value = await lookup({ playerId, puzzleDate, slot: String(slot) }) as { preview?: unknown };
      if (!isPreview(value?.preview, playerId)) throw new Error('invalid');
      if (request === generation.current) setPreview(value.preview);
    } catch { if (request === generation.current) setError(true); }
    finally { if (request === generation.current) setBusy(false); }
  }

  return <div>
    <form onSubmit={search} style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
      <input type="search" minLength={2} maxLength={80} value={query} disabled={busy} required
        aria-label="Search player name or alias" placeholder="Search player name or alias" style={inputStyle}
        onChange={event => { generation.current++; setQuery((event.target as unknown as { value: string }).value); setResults(null); setPreview(null); setError(false); }} />
      <button type="submit" style={buttonStyle} disabled={busy}>{busy ? 'Loading…' : 'Search'}</button>
    </form>
    {error ? <p role="alert">Player search or preview is temporarily unavailable.</p> : null}
    {results !== null ? <section aria-label="Player search results" aria-live="polite">
      {results.length === 0 ? <p>No Daily candidates matched.</p> : null}
      {hasMore ? <p>Showing the first 25 matches. Refine the search to find a specific player.</p> : null}
      <ul style={{ display: 'grid', gap: 10, padding: 0, listStyle: 'none' }}>{results.map(player => <li key={player.canonicalPlayerId}>
        <button type="button" style={resultStyle} disabled={busy} onClick={() => select(player.canonicalPlayerId)}>
          {player.displayName}{player.requiresYearDisambiguation ? ` (${player.yearsPlayedDisplay})` : ''}
          {' · '}{player.playerType}{' · '}{player.primaryPosition}{' · '}{player.teamsDisplay || 'Teams unavailable'}
          {' · Rank '}{player.recognizabilityRank ?? '—'}{' · '}{player.canonicalPlayerId}
        </button>
      </li>)}</ul>
    </section> : null}
    {preview !== null ? <section aria-label="Exact game preview">
      <p>Exact game preview</p><h3>{preview.displayName} · {preview.initials}</h3>
      <p>{preview.firstSeason}–{preview.lastSeason} · {preview.playerType} · {preview.position} · {preview.teams}</p>
      {preview.careerLines.map(line => <p key={line}>{line}</p>)}
      <p>Regular-season reveal rows: {preview.seasonCount}</p>
      <ol>{preview.hints.map(hint => <li key={hint.hintLabel}><strong>{hint.hintLabel}:</strong> {hint.hintValue}</li>)}</ol>
      <form action="/admin/daily/replace" method="post">
        <input type="hidden" name="puzzleDate" value={puzzleDate} />
        <input type="hidden" name="slot" value={slot} />
        <input type="hidden" name="canonicalPlayerId" value={preview.canonicalPlayerId} />
        <button type="submit" style={buttonStyle}>Replace slot {slot} with {preview.displayName}</button>
      </form>
    </section> : null}
  </div>;
}

const buttonStyle = { border: '1px solid #162116', borderRadius: 10, padding: '12px 16px', background: '#173326', color: '#f9f3e6', font: 'inherit', fontWeight: 700, cursor: 'pointer' } as const;
const inputStyle = { minWidth: 0, width: 300, maxWidth: '100%', flex: 1, border: '1px solid rgba(22, 33, 22, 0.35)', borderRadius: 8, padding: '12px 14px', font: 'inherit' } as const;
const resultStyle = { width: '100%', textAlign: 'left', padding: 12, border: '1px solid rgba(22, 33, 22, 0.2)', borderRadius: 10, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' } as const;
