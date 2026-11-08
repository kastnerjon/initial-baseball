'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { parseCompletionDisplayName } from '@initial-baseball/shared';
import {
  createCustomV2CompletionDisplayBrowserClient,
  CustomCompletionDisplayError,
  type CustomCompletionDisplayChoice,
} from '../customV2CompletionDisplayBrowserClient';

type Phase = 'loading' | 'editing' | 'saving' | 'saved' | 'error';
type ErrorKind = 'unavailable' | 'unauthorized' | 'conflict' | null;

/**
 * Shown ONLY after the existing score-admission POST has succeeded.
 * Local state is an editable choice until the server confirms first-write-wins.
 * Each remount reads the authoritative cookie-bound preference afresh.
 */
export function CustomLineupCompletionDisplay({ puzzleId }: {
  puzzleId: string;
}): JSX.Element {
  const client = useMemo(() => createCustomV2CompletionDisplayBrowserClient(), []);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<CustomCompletionDisplayChoice | null>(null);
  const [error, setError] = useState<ErrorKind>(null);

  const load = useCallback(async () => {
    abort.current?.abort();
    const request = new AbortController();
    abort.current = request;
    const epoch = ++generation.current;
    busy.current = true;
    setPhase('loading');
    setError(null);
    try {
      const saved = await client.read(puzzleId, request.signal);
      if (generation.current !== epoch) return;
      setChoice(saved);
      setPhase(saved === null ? 'editing' : 'saved');
    } catch (e) {
      if (generation.current !== epoch) return;
      setError(e instanceof CustomCompletionDisplayError && e.kind === 'unauthorized'
        ? 'unauthorized' : 'unavailable');
      setPhase('error');
    } finally {
      if (generation.current === epoch) busy.current = false;
    }
  }, [client, puzzleId]);

  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
      abort.current?.abort();
      busy.current = false;
    };
  }, [load]);

  async function save(next: CustomCompletionDisplayChoice) {
    if (busy.current || phase !== 'editing') return;
    const request = new AbortController();
    abort.current?.abort();
    abort.current = request;
    const epoch = ++generation.current;
    busy.current = true;
    setPhase('saving');
    setError(null);
    try {
      await client.save(puzzleId, next, request.signal);
      if (epoch !== generation.current) return;
      setChoice(next);
      setPhase('saved');
    } catch (e) {
      if (epoch !== generation.current) return;
      // On a lost POST response or another tab's first write, re-read the
      // immutable winner before permitting another choice.
      try {
        const saved = await client.read(puzzleId, request.signal);
        if (epoch !== generation.current) return;
        if (saved !== null) {
          setChoice(saved);
          setPhase('saved');
          return;
        }
      } catch {
        // Keep the result safe and unmodified; user can retry the read.
      }
      setError(e instanceof CustomCompletionDisplayError
        && e.kind === 'unauthorized' ? 'unauthorized'
        : e instanceof CustomCompletionDisplayError && e.kind === 'conflict'
          ? 'conflict' : 'unavailable');
      setPhase('error');
    } finally {
      if (generation.current === epoch) busy.current = false;
    }
  }

  const parsed = parseCompletionDisplayName(name);
  const valid = parsed.ok;
  return (
    <section className="custom-lineup-completion-identity"
      aria-labelledby="custom-completion-name-heading">
      <h3 id="custom-completion-name-heading">Your name on this result</h3>
      {phase === 'loading' || phase === 'saving' ? (
        <p role="status">{phase === 'loading' ? 'Checking your saved display choice…'
          : 'Saving your display choice…'}</p>
      ) : null}
      {phase === 'saved' && choice !== null ? (
        <>
          <p role="status">{choice.mode === 'anonymous'
            ? 'Saved as Anonymous.'
            : <>Saved as <strong>{choice.displayName}</strong>.</>}</p>
          <p className="custom-lineup-muted">This choice is attached to your first saved result.
            It cannot be changed later.</p>
        </>
      ) : null}
      {phase === 'editing' ? (
        <>
          <p className="custom-lineup-muted">Choose how your result appears to others.
            Your score is already saved. This is a one-time choice, not account verification.</p>
          <form onSubmit={event => {
            event.preventDefault();
            if (parsed.ok) void save({ mode: 'named', displayName: parsed.displayName });
          }}>
            <label htmlFor="custom-completion-display-name">Display name (up to 32 characters)</label>
            <input id="custom-completion-display-name" type="text" maxLength={32}
              autoComplete="off" value={name} onChange={event => { if ('value' in event.target) setName(event.target.value); }} />
            <div className="custom-lineup-actions">
              <button className="custom-lineup-primary" type="submit" disabled={!valid}>
                Save name
              </button>
              <button className="custom-lineup-secondary" type="button"
                onClick={() => { void save({ mode: 'anonymous' }); }}>
                Continue anonymously
              </button>
            </div>
          </form>
        </>
      ) : null}
      {phase === 'error' ? (
        <>
          <p role="alert" className="custom-lineup-error">
            {error === 'unauthorized'
              ? 'This browser cannot access the result display.'
              : error === 'conflict'
                ? 'This result already has a different display choice.'
                : 'Your display choice could not be confirmed. Your score is unchanged.'}
          </p>
          <button type="button" className="custom-lineup-secondary" onClick={() => { void load(); }}>
            Check saved choice again
          </button>
        </>
      ) : null}
    </section>
  );
}
