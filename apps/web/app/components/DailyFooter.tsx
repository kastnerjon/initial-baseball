import React, { type JSX } from 'react';

type Props = { createLineupAvailable: boolean };

/** Presentational only: the server page decides whether both release gates allow this entry. */
export function DailyFooter({ createLineupAvailable }: Props): JSX.Element {
  return <footer className="daily-footer">
    <div className="daily-footer-links">
      <a href="/archive">Play the archive</a>
      <a href="/results">My Results</a>
      {createLineupAvailable ? <a href="/create">Create a Lineup</a> : null}
    </div>
    <span>One lineup every day.</span>
    <span>New puzzle · Midnight Pacific</span>
  </footer>;
}
