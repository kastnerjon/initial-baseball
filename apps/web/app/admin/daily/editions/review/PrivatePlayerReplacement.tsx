'use client';

import React, { useState, type JSX } from 'react';
import PrivatePlayerLookup from '../players/PrivatePlayerLookup';

export default function PrivatePlayerReplacement({ occurrenceId, revision, selections }: {
  occurrenceId: string; revision: number;
  selections: readonly { slot: number; canonicalPlayerId: string; displayName: string | null }[];
}): JSX.Element {
  const [candidate, setCandidate] = useState('');
  return <section aria-label="Replace a draft player">
    <h3>Replace one player</h3>
    <p>A replacement creates a new draft revision. It cannot change a scheduled
      or issued lineup. Reload this page if another editor changed the draft.</p>
    <PrivatePlayerLookup onSelect={player => setCandidate(player.canonicalPlayerId)}
      onQueryChange={() => setCandidate('')} />
    <form method="post" action="/admin/daily/editions/review/replace">
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
      <input type="hidden" name="expectedRevision" value={String(revision)} />
      <label htmlFor="draft-replace-slot">Batting-order slot</label>
      <select id="draft-replace-slot" name="slot" required defaultValue="">
        <option value="" disabled>Select a player</option>
        {selections.map(selection => <option key={selection.slot} value={selection.slot}>
          {selection.slot} · {selection.displayName ?? selection.canonicalPlayerId}
        </option>)}
      </select>
      <label htmlFor="draft-replace-player">Replacement canonical player ID</label>
      <input id="draft-replace-player" name="canonicalPlayerId" type="text" maxLength={200}
        required autoComplete="off" value={candidate} onChange={event => setCandidate((event.target as unknown as { value: string }).value)} />
      <p>Confirm the batting-order slot and selected player before submitting this revision.</p>
      <button type="submit">Replace selected player</button>
    </form>
  </section>;
}
