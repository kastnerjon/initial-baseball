'use client';

import { useState, type JSX } from 'react';

type ShareCopyState =
  | { status: 'idle' }
  | { status: 'copying' | 'copied' | 'error'; text: string };

export function DailyShareCard({ shareText }: { shareText: string }): JSX.Element {
  const [copyState, setCopyState] = useState<ShareCopyState>({ status: 'idle' });
  const copying = copyState.status === 'copying';
  const copied = copyState.status === 'copied' && copyState.text === shareText;
  const error = copyState.status === 'error' && copyState.text === shareText;

  return (
    <section className="share-card" aria-label="Spoiler-free share card">
      <div className="share-card-header">
        <h2>Share result</h2>
        <button type="button" className="button-secondary" onClick={() => { void copy(); }} disabled={copying}>
          {copied ? 'Copied!' : copying ? 'Copying…' : 'Copy'}
        </button>
      </div>
      <pre className="share-text" tabIndex={0}>{shareText}</pre>
      <p className="share-copy-status" role="status">
        {copied ? 'Result copied. No answers included.' : error ? 'Could not copy. Select the text above to copy it manually.' : ''}
      </p>
    </section>
  );

  async function copy(): Promise<void> {
    const textToCopy = shareText;
    setCopyState({ status: 'copying', text: textToCopy });
    try {
      const clipboard = (globalThis as { navigator?: { clipboard?: { writeText(text: string): Promise<void> } } }).navigator?.clipboard;
      if (!clipboard) throw new Error('Clipboard unavailable');
      await clipboard.writeText(textToCopy);
      setCopyState({ status: 'copied', text: textToCopy });
    } catch {
      setCopyState({ status: 'error', text: textToCopy });
    }
  }
}
