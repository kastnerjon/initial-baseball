'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { parseCompletionDisplayName } from '@initial-baseball/shared';
import {
  createCustomV2CompletionDisplayBrowserTransport,
  type CustomV2CompletionDisplay, type CustomV2CompletionDisplayChoice,
} from '../customV2CompletionDisplayBrowserTransport';

type View =
  | { kind: 'loading' }
  | { kind: 'saving' }
  | { kind: 'error' }
  | { kind: 'editing'; error?: string }
  | { kind: 'saved'; display: CustomV2CompletionDisplay };

/** An "existing" HTTP response only proves a prior write won. Never
 * display the losing draft as if it were the stored immutable choice.
 */
export async function resolveCompletionDisplayAfterWrite(
  status: 'created' | 'existing',
  draft: CustomV2CompletionDisplay,
  readSaved: () => Promise<CustomV2CompletionDisplay | null>,
): Promise<CustomV2CompletionDisplay> {
  if (status === 'created') return draft;
  const stored = await readSaved();
  if (stored === null) throw new Error('Original Custom result choice is unavailable.');
  return stored;
}

/** Only mounted after the server confirms atomic scoring admission, never as
 * a substitute for that admission. The name is optional and immutable.
 */
export function CustomLineupCompletionDisplay({ puzzleId }: {
  puzzleId: string;
}): JSX.Element {
  const client = useMemo(() => createCustomV2CompletionDisplayBrowserTransport(), []);
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [draft, setDraft] = useState('');
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(() => {
    const current = ++generation.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setView({ kind: 'loading' });
    void client.read(puzzleId, controller.signal).then(display => {
      if (controller.signal.aborted || generation.current !== current) return;
      setView(display === null ? { kind: 'editing' } : { kind: 'saved', display });
    }).catch(() => {
      if (!controller.signal.aborted && generation.current === current) {
        setView({ kind: 'error' });
      }
    });
  }, [client, puzzleId]);

  useEffect(() => {
    refresh();
    return () => {
      generation.current++;
      active.current?.abort();
    };
  }, [refresh]);

  function submit(choice: CustomV2CompletionDisplayChoice): void {
    if (view.kind !== 'editing') return;
    const current = ++generation.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setView({ kind: 'saving' });
    const display: CustomV2CompletionDisplay = choice.mode === 'anonymous'
      ? { mode: 'anonymous', displayName: null }
      : { mode: 'named', displayName: choice.displayName };

    void client.record(puzzleId, choice, controller.signal).then(async status => {
      // A second tab may have won the immutable first-write race with a
      // different name/Anonymous choice. "existing" is not an acknowledgement
      // that this tab's newly submitted choice was stored.
      const stored = await resolveCompletionDisplayAfterWrite(status, display,
        () => client.read(puzzleId, controller.signal));
      if (!controller.signal.aborted && generation.current === current) {
        setView({ kind: 'saved', display: stored });
      }
    }).catch(async () => {
      // An interrupted POST might have committed anyway, or a second tab may
      // have selected the original identity. Re-read authority before retry.
      if (controller.signal.aborted || generation.current !== current) return;
      try {
        const existing = await client.read(puzzleId, controller.signal);
        if (controller.signal.aborted || generation.current !== current) return;
        if (existing !== null) { setView({ kind: 'saved', display: existing }); return; }
      } catch {
        if (controller.signal.aborted || generation.current !== current) return;
      }
      setView({ kind: 'editing', error: 'Your choice could not be saved. Try again.' });
    });
  }

  function saveNamed(): void {
    const parsed = parseCompletionDisplayName(draft);
    if (!parsed.ok) {
      setView({ kind: 'editing', error: 'Enter a name of 1–32 characters.' });
      return;
    }
    submit({ mode: 'named', displayName: parsed.displayName });
  }

  return (
    <div className="custom-lineup-completion-display" aria-label="Completion display choice">
      <h3>How should your result appear?</h3>
      {view.kind === 'loading' ? (
        <p className="custom-lineup-muted" role="status">Checking your saved result choice…</p>
      ) : view.kind === 'saving' ? (
        <p className="custom-lineup-muted" role="status">Saving your result choice…</p>
      ) : view.kind === 'error' ? (
        <>
          <p className="custom-lineup-error" role="alert">
            Could not load your saved choice. Your score is unchanged.
          </p>
          <button type="button" className="custom-lineup-secondary" onClick={refresh}>
            Retry loading
          </button>
        </>
      ) : view.kind === 'saved' ? (
        <>
          <p role="status">
            {view.display.mode === 'anonymous'
              ? 'Saved as Anonymous.'
              : <>Name saved: <strong>{view.display.displayName}</strong>.</>}
          </p>
          <p className="custom-lineup-muted">
            Your first-result choice is preserved for this browser and cannot be changed.
          </p>
        </>
      ) : (
        <>
          <p className="custom-lineup-muted">
            Choose a display name or remain Anonymous. This does not create an account.
            Your first choice is permanent for this result.
          </p>
          <form onSubmit={event => { event.preventDefault(); saveNamed(); }}>
            <label htmlFor="custom-lineup-result-name">Display name (optional)</label>
            <input id="custom-lineup-result-name" type="text" maxLength={32}
              autoComplete="off" value={draft}
              onChange={event => {
                if ('value' in event.target && typeof event.target.value === 'string') {
                  setDraft(event.target.value);
                  if (view.error) setView({ kind: 'editing' });
                }
              }}
              placeholder="Your name" />
            {view.error ? <p className="custom-lineup-error" role="alert">{view.error}</p> : null}
            <div className="custom-lineup-actions">
              <button type="submit" className="custom-lineup-primary">Save name</button>
              <button type="button" className="custom-lineup-secondary"
                onClick={() => { submit({ mode: 'anonymous' }); }}>Stay Anonymous</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
