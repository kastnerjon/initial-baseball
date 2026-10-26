'use client';
import { useEffect, useState, type JSX } from 'react';

type Creation = Readonly<{ puzzleId: string; title: string; issuedAt: string }>;
const ID = /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isCreation(value: unknown): value is Creation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.puzzleId === 'string' && ID.test(v.puzzleId)
    && typeof v.title === 'string' && v.title.length >= 3 && v.title.length <= 60
    && typeof v.issuedAt === 'string' && !Number.isNaN(Date.parse(v.issuedAt));
}

export default function MyCreationsClient(): JSX.Element {
  const [creations, setCreations] = useState<readonly Creation[] | null>(null);
  const [error, setError] = useState<'sign-in' | 'unavailable' | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/account/creations', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { setError('sign-in'); return; }
        if (!response.ok) throw new Error('unavailable');
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== 'object' || !('creations' in payload)
          || !Array.isArray(payload.creations) || payload.creations.length > 40
          || !payload.creations.every(isCreation)) throw new Error('invalid response');
        if (!controller.signal.aborted) setCreations(payload.creations);
      }).catch(() => {
        if (!controller.signal.aborted) setError('unavailable');
      });
    return () => controller.abort();
  }, []);

  return <main style={{ maxWidth: 640, margin: '3rem auto', padding: '1rem' }}>
    <h1>My Creations</h1>
    <p>Private, unlisted Custom Lineups saved by this account. Your friends can play using each sharing link.</p>
    <p><a href="/create">Create another lineup</a> · <a href="/account">Account</a></p>
    {error === 'sign-in' ? <p role="alert">Sign in to view your creations. <a href="/account">Sign in</a></p> : null}
    {error === 'unavailable' ? <p role="alert">Your creations are temporarily unavailable. Try again later.</p> : null}
    {creations === null && error === null ? <p role="status">Loading creations…</p> : null}
    {creations?.length === 0 ? <p>No saved lineups yet.</p> : null}
    {creations && creations.length > 0 ? <ol>
      {creations.map(creation => <li key={creation.puzzleId}>
        <strong>{creation.title}</strong>
        {' · '}{new Date(creation.issuedAt).toLocaleDateString()}
        {' · '}<a href={'/custom/' + encodeURIComponent(creation.puzzleId)}>Open friend link</a>
      </li>)}
    </ol> : null}
    {creations && creations.length === 40 ? <p>Showing the 40 newest creations. Older creations will be available through pagination later.</p> : null}
  </main>;
}
