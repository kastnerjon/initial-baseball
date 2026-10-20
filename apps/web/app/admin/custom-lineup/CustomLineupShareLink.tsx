'use client';

import React, { useEffect, useState, type JSX } from 'react';

type NativeShare = (data: { title: string; url: string }) => Promise<void>;

/** The share sheet receives only the same-origin friend URL, never owner codes. */
export async function requestNativeCustomLineupShare(
  url: string, share: NativeShare,
): Promise<'completed' | 'cancelled' | 'failed'> {
  try {
    await share({ title: 'Initial Baseball Custom Lineup', url });
    return 'completed';
  } catch (error) {
    if (error !== null && typeof error === 'object'
      && 'name' in error && error.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

/** Receives only the opaque ID already validated by the issuance response boundary. */
export function CustomLineupShareLink({ puzzleId }: { puzzleId: string }): JSX.Element {
  const path = '/custom/' + encodeURIComponent(puzzleId);
  const [url, setUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);

  useEffect(() => {
    const browser = globalThis as unknown as { location: { origin: string } };
    setUrl(new URL(path, browser.location.origin).href);
    setFeedback(null);
    setNativeShareAvailable(typeof (navigator as Navigator & { share?: NativeShare }).share === 'function');
  }, [path]);

  async function copy(): Promise<void> {
    if (url === null) return;
    try {
      const clipboard = (navigator as Navigator & { clipboard?: { writeText: (text: string) => Promise<void> } }).clipboard;
      if (!clipboard) throw new Error('Clipboard unavailable');
      await clipboard.writeText(url);
      setFeedback('Challenge link copied.');
    } catch {
      setFeedback('Could not copy automatically. Select and copy the challenge link.');
    }
  }

  async function share(): Promise<void> {
    if (url === null) return;
    const method = (navigator as Navigator & { share?: NativeShare }).share;
    if (typeof method !== 'function') return;
    const outcome = await requestNativeCustomLineupShare(url, data => method.call(navigator, data));
    if (outcome === 'failed') setFeedback('Could not open sharing. Copy the challenge link instead.');
    else if (outcome === 'completed') setFeedback(null);
    // Dismissing the system share sheet is not an error and makes no success claim.
  }

  return <div className="custom-lineup-share-link">
    <p>Send this link to friends to play your lineup. Anyone with the link can open it.</p>
    <label htmlFor="custom-lineup-share-url">Challenge link</label>
    <input id="custom-lineup-share-url" type="text" readOnly value={url ?? path}
      onFocus={event => {
        const input = event.currentTarget as unknown as { select: () => void };
        input.select();
      }} />
    <div className="custom-lineup-share-actions">
      {nativeShareAvailable && url !== null ? (
        <button type="button" onClick={() => { void share(); }}>Share challenge</button>
      ) : null}
      <button type="button" disabled={url === null} onClick={() => { void copy(); }}>
        Copy challenge link
      </button>
      <a href={path}>Preview your challenge</a>
    </div>
    <p>Your browser previews the lineup without contributing a competitive result.</p>
    {feedback !== null ? <p role="status">{feedback}</p> : null}
  </div>;
}
