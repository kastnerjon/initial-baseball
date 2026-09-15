'use client';

import { useState, type JSX } from 'react';

export function DailyShareCard({ shareText }: { shareText: string }): JSX.Element {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  return (
    <section className="share-card" aria-label="Spoiler-free share card">
      <div className="share-card-header">
        <h2>Share result</h2>
        <button type="button" className="button-secondary" onClick={() => { void copy(); }} disabled={status === 'copying'}>
          {status === 'copied' ? 'Copied!' : status === 'copying' ? 'Copying…' : 'Copy'}
        </button>
      </div>
      <pre className="share-text" tabIndex={0}>{shareText}</pre>
      <p className="share-copy-status" role="status">
        {status === 'copied' ? 'Result copied. No answers included.' : status === 'error' ? 'Could not copy. Select the text above to copy it manually.' : ''}
      </p>
    </section>
  );

  async function copy(): Promise<void> {
    setStatus('copying');
    try {
      const clipboard = (globalThis as { navigator?: { clipboard?: { writeText(text: string): Promise<void> } } }).navigator?.clipboard;
      if (!clipboard) throw new Error('Clipboard unavailable');
      await clipboard.writeText(shareText);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  }
}
