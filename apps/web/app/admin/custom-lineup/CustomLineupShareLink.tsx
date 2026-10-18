'use client';

import React, { useEffect, useState, type JSX } from 'react';

/** Receives only the opaque ID already validated by the issuance response boundary. */
export function CustomLineupShareLink({ puzzleId }: { puzzleId: string }): JSX.Element {
  const path = '/custom/' + encodeURIComponent(puzzleId);
  const [url, setUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const browser = globalThis as unknown as { location: { origin: string } };
    setUrl(new URL(path, browser.location.origin).href);
    setFeedback(null);
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

  return <div className="custom-lineup-share-link">
    <p>Send this link to friends to play your lineup. Anyone with the link can open it.</p>
    <label htmlFor="custom-lineup-share-url">Challenge link</label>
    <input id="custom-lineup-share-url" type="text" readOnly value={url ?? path}
      onFocus={event => {
        const input = event.currentTarget as unknown as { select: () => void };
        input.select();
      }} />
    <div className="custom-lineup-share-actions">
      <button type="button" disabled={url === null} onClick={() => { void copy(); }}>
        Copy challenge link
      </button>
      <a href={path}>Preview your challenge</a>
    </div>
    <p>Your browser previews the lineup without contributing a competitive result.</p>
    {feedback !== null ? <p role="status">{feedback}</p> : null}
  </div>;
}
