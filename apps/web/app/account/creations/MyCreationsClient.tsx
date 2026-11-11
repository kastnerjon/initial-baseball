'use client';
import React, { useEffect, useRef, useState, type JSX } from 'react';
import { parseCustomLineupTitle } from '@initial-baseball/shared';

type Creation = Readonly<{ puzzleId: string; title: string; issuedAt: string }>;
type CreationsPage = Readonly<{ creations: readonly Creation[]; nextCursor: string | null }>;
type CopyStatus = Readonly<{ id: string; ok: boolean }> | null;
const ID = /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCreation(value: unknown): value is Creation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.puzzleId === 'string' && ID.test(v.puzzleId)
    && typeof v.title === 'string' && parseCustomLineupTitle(v.title).ok
    && typeof v.issuedAt === 'string' && !Number.isNaN(Date.parse(v.issuedAt));
}

export function parseCreationsPage(value: unknown): CreationsPage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (!Array.isArray(payload.creations) || payload.creations.length > 40
    || !payload.creations.every(isCreation)) return null;
  if (payload.nextCursor !== null
    && (typeof payload.nextCursor !== 'string' || payload.nextCursor.length < 1
      || payload.nextCursor.length > 128 || payload.creations.length !== 40)) return null;
  if (new Set(payload.creations.map((item: Creation) => item.puzzleId)).size
    !== payload.creations.length) return null;
  return { creations: payload.creations, nextCursor: payload.nextCursor };
}

/** Build only same-origin guest play links from verified immutable Custom IDs. */
export function creationShareUrl(puzzleId: string, origin: string): string | null {
  if (!ID.test(puzzleId)) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || (parsed.protocol !== 'https:'
      && !(parsed.protocol === 'http:' && parsed.hostname === 'localhost'))) return null;
    return parsed.origin + '/custom/' + encodeURIComponent(puzzleId);
  } catch { return null; }
}

/** Safe, metadata-only row, also independently rendered in privacy regression tests. */
export function CreationRow({ creation, copyStatus, onCopy }: {
  creation: Creation; copyStatus: CopyStatus; onCopy: (id: string) => void;
}): JSX.Element {
  return <li>
    <strong>{creation.title}</strong>
    {' · '}{new Date(creation.issuedAt).toLocaleDateString()}
    {' · '}<a href={'/custom/' + encodeURIComponent(creation.puzzleId)}>Open friend link</a>
    {' · '}<button type="button" onClick={() => onCopy(creation.puzzleId)}>
      Copy friend link
    </button>
    {copyStatus?.id === creation.puzzleId ? (
      <span role="status">{copyStatus.ok
        ? ' Link copied.' : ' Copy unavailable; open the friend link and copy its address.'}</span>
    ) : null}
  </li>;
}

export default function MyCreationsClient(): JSX.Element {
  const [creations, setCreations] = useState<readonly Creation[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<'sign-in' | 'unavailable' | null>(null);
  const [olderError, setOlderError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const olderController = useRef<AbortController | null>(null);

  async function copyFriendLink(puzzleId: string): Promise<void> {
    const browser = globalThis as typeof globalThis & {
      location?: { origin: string };
      navigator?: { clipboard?: { writeText(value: string): Promise<void> } };
    };
    const url = creationShareUrl(puzzleId, browser.location?.origin ?? '');
    if (!url || !browser.navigator?.clipboard?.writeText) {
      setCopyStatus({ id: puzzleId, ok: false });
      return;
    }
    try {
      await browser.navigator.clipboard.writeText(url);
      setCopyStatus({ id: puzzleId, ok: true });
    } catch {
      setCopyStatus({ id: puzzleId, ok: false });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/account/creations', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (controller.signal.aborted) return;
        if (response.status === 401) { setError('sign-in'); return; }
        if (!response.ok) throw new Error('unavailable');
        const page = parseCreationsPage(await response.json());
        if (!page) throw new Error('invalid response');
        if (!controller.signal.aborted) {
          setCreations(page.creations);
          setNextCursor(page.nextCursor);
        }
      }).catch(() => {
        if (!controller.signal.aborted) setError('unavailable');
      });
    return () => { controller.abort(); olderController.current?.abort(); };
  }, []);

  async function loadOlder(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    const controller = new AbortController();
    olderController.current?.abort();
    olderController.current = controller;
    setLoadingMore(true);
    setOlderError(false);
    try {
      const response = await fetch('/api/account/creations?cursor=' + encodeURIComponent(nextCursor), {
        credentials: 'same-origin', signal: controller.signal,
      });
      if (response.status === 401) {
        if (!controller.signal.aborted) {
          setCreations(null);
          setNextCursor(null);
          setError('sign-in');
        }
        return;
      }
      if (!response.ok) throw new Error('unavailable');
      const page = parseCreationsPage(await response.json());
      if (!page) throw new Error('invalid response');
      if (!controller.signal.aborted) {
        setCreations(previous => {
          if (!previous) return page.creations;
          const seen = new Set(previous.map(item => item.puzzleId));
          return [...previous, ...page.creations.filter(item => !seen.has(item.puzzleId))];
        });
        setNextCursor(page.nextCursor);
      }
    } catch {
      if (!controller.signal.aborted) setOlderError(true);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  return <main style={{ maxWidth: 640, margin: '3rem auto', padding: '1rem' }}>
    <h1>My Creations</h1>
    <p>Private, unlisted Custom Lineups saved by this account. Your friends can play using each sharing link.</p>
    <p><a href="/create">Create another lineup</a> · <a href="/account">Account</a></p>
    {error === 'sign-in' ? <p role="alert">Sign in to view your creations. <a href="/account">Sign in</a></p> : null}
    {error === 'unavailable' ? <p role="alert">Your creations are temporarily unavailable. Try again later.</p> : null}
    {creations === null && error === null ? <p role="status">Loading creations…</p> : null}
    {creations?.length === 0 ? <p>No saved lineups yet.</p> : null}
    {creations && creations.length > 0 ? <ol>
      {creations.map(creation => <CreationRow key={creation.puzzleId}
        creation={creation} copyStatus={copyStatus}
        onCopy={id => { void copyFriendLink(id); }} />)}
    </ol> : null}
    {nextCursor && error === null ? <p>
      <button type="button" disabled={loadingMore} onClick={() => { void loadOlder(); }}>
        {loadingMore ? 'Loading older lineups…' : 'Show older lineups'}
      </button>
    </p> : null}
    {olderError ? <p role="alert">Older lineups are temporarily unavailable. Try again.</p> : null}
  </main>;
}
