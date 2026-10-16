import React, { type JSX } from 'react';
import type { CustomLineupV2BrowserResolution } from '../customLineupV2BrowserTransport';
import { PlayerRevealCard } from '../components/PlayerRevealCard';

type Terminal = Extract<CustomLineupV2BrowserResolution, { kind: 'terminal' }>;

/** The committed terminal reveal remains visible if reloading the next batter fails. */
export function CustomLineupTerminalPanel({
  terminal, error, loading, onContinue,
}: {
  terminal: Terminal;
  error: string | null;
  loading: boolean;
  onContinue: () => void;
}): JSX.Element {
  return (
    <section className="custom-lineup-panel" aria-live="polite">
      <span className="custom-lineup-kicker">At-bat result</span>
      <h2>{terminal.result.outcome}</h2>
      <PlayerRevealCard reveal={terminal.reveal} />
      {error !== null ? <p className="custom-lineup-error" role="alert">{error}</p> : null}
      <button type="button" className="custom-lineup-primary" disabled={loading}
        onClick={onContinue}>
        {terminal.completed ? 'View final score' : 'Next batter'}
      </button>
    </section>
  );
}
