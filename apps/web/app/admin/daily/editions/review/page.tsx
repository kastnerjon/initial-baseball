import React, { type JSX } from 'react';
import { headers } from 'next/headers';
import { getPacificDailyDateString } from '../../../../getPacificDailyDateString';
import { notFound, redirect } from 'next/navigation';
import { isOfficialDailyOccurrenceId } from '@initial-baseball/daily';
import {
  DailyAdminAuthorizationError, requireDailyAdminPrincipal,
} from '../../../../dailyAdminAuthorization';
import { DAILY_ADMIN_AUTH_PATH } from '../../../../dailyAdminPaths';
import { isFirstPartyDailyAdminNavigation } from '../../../../dailyAdminRequestSecurity';
import {
  readOfficialDailyEditorialDraftPreview,
  type OfficialDailyDraftPreview,
} from '../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

type Parameters = Record<string, string | string[] | undefined>;
type PlayerSelection = { slot: number; canonicalPlayerId: string };
type ReviewQuery = { kind: 'empty' | 'invalid' }
  | { kind: 'valid'; occurrenceId: string; selection: PlayerSelection | null };
const inputStyle = { width: '100%', maxWidth: 430 } as const;

function parseReviewQuery(params: Parameters): ReviewQuery {
  const keys = Object.keys(params);
  if (keys.length === 0) return { kind: 'empty' };
  if (keys.length !== 1 && keys.length !== 3) return { kind: 'invalid' };
  if (keys.some(key => !['occurrenceId', 'slot', 'canonicalPlayerId'].includes(key)))
    return { kind: 'invalid' };
  const id = params.occurrenceId;
  if (typeof id !== 'string' || !isOfficialDailyOccurrenceId(id))
    return { kind: 'invalid' };
  if (keys.length === 1) return { kind: 'valid', occurrenceId: id, selection: null };
  const slot = params.slot;
  const candidate = params.canonicalPlayerId;
  if (typeof slot !== 'string' || !/^[1-9]$/.test(slot)
      || typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 200
      || candidate.trim() !== candidate || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', occurrenceId: id,
    selection: { slot: Number(slot), canonicalPlayerId: candidate } };
}

function EditorialPreview({ preview, selection }: {
  preview: OfficialDailyDraftPreview; selection: PlayerSelection | null;
}) {
  const scheduledPlayersResolved = preview.selections.length === 9
    && preview.selections.every(selection =>
      typeof selection.displayName === 'string' && selection.displayName.trim().length > 0);
  return (
    <section aria-label="Reviewed secondary Daily roster">
      <h2>{preview.title} · Puzzle {preview.editionNumber}</h2>
      <p><strong>Pacific date:</strong> {preview.puzzleDate}</p>
      <p><strong>Edition key:</strong> {preview.editionKey}</p>
      <p><strong>Status:</strong> {preview.status}</p>
      <p><strong>Current editorial revision:</strong> {preview.revision}</p>
      <p><strong>Occurrence ID:</strong> <code>{preview.occurrenceId}</code></p>
      {preview.status === 'draft'
        && preview.puzzleDate > getPacificDailyDateString(new Date()) ? (
          <form method="post" action="/admin/daily/editions/review/rename">
            <input type="hidden" name="occurrenceId" value={preview.occurrenceId} />
            <input type="hidden" name="expectedRevision" value={String(preview.revision)} />
            <label htmlFor="official-edition-title">Puzzle title</label>
            <input id="official-edition-title" name="title" defaultValue={preview.title}
              style={inputStyle} required />
            <button type="submit">Save title</button>
          </form>
        ) : null}
      <p><a href="/admin/daily/editions/players">Find canonical player IDs by name</a></p>
      <h3>Selected players (batting order)</h3>
      <ol>
        {preview.selections.map(selection => (
          <li key={selection.slot}>
            <strong>{selection.slot}.</strong>{' '}
            {selection.displayName ?? 'Unresolved player'}
            {' · '}<code>{selection.canonicalPlayerId}</code>
            {preview.status === 'draft' ? <> {' · '}
              <a href={'/admin/daily/editions/players?'
                + new URLSearchParams({
                  occurrenceId: preview.occurrenceId, slot: String(selection.slot),
                }).toString()}>Find replacement for slot {selection.slot}</a>
            </> : null}
          </li>
        ))}
      </ol>
      {preview.status === 'draft' ? (
        <section aria-label="Replace a draft player">
          <h3>Replace one player</h3>
          <p>A replacement creates a new draft revision. It cannot change a scheduled
            or issued lineup. Reload this page if another editor changed the draft.</p>
          <form method="post" action="/admin/daily/editions/review/replace">
            <input type="hidden" name="occurrenceId" value={preview.occurrenceId} />
            <input type="hidden" name="expectedRevision" value={String(preview.revision)} />
            <label htmlFor="draft-replace-slot">Batting-order slot</label>
            <select id="draft-replace-slot" name="slot" required
              defaultValue={selection ? String(selection.slot) : ''}>
              <option value="" disabled>Select a player</option>
              {preview.selections.map(selection => (
                <option key={selection.slot} value={selection.slot}>
                  {selection.slot} · {selection.displayName ?? selection.canonicalPlayerId}
                </option>
              ))}
            </select>
            <label htmlFor="draft-replace-player">Replacement canonical player ID</label>
            <input id="draft-replace-player" name="canonicalPlayerId"
              type="text" maxLength={200} required autoComplete="off"
              defaultValue={selection?.canonicalPlayerId ?? ''} />
            {selection ? <p>Player selected from the lookup. Confirm the correct
              batting-order slot and player before submitting this revision.</p> : null}
            <button type="submit">Replace selected player</button>
          </form>
        </section>
      ) : null}
      <p role="status">
        {preview.status === 'draft'
          ? preview.canSchedule
            ? 'All nine players have canonical clue material available for scheduling review.'
            : 'This edition is not currently ready to schedule. Check the player records, clues, date and editorial status.'
          : preview.status === 'scheduled'
            ? scheduledPlayersResolved
              ? 'Scheduled; issuance separately freezes the reviewed lineup and clues.'
              : 'This scheduled edition cannot be issued until all nine canonical players resolve. Check the player catalog.'
            : 'This edition has already been issued with immutable frozen clues.'}
      </p>
      <p>Review all nine selected players before confirming. Scheduling is separate
        from issuance or publication, and the server will recheck the clues.</p>
      {preview.status === 'draft' && preview.canSchedule ? (
        <form method="post" action="/admin/daily/editions/review/confirm">
          <input type="hidden" name="occurrenceId" value={preview.occurrenceId} />
          <input type="hidden" name="expectedRevision" value={String(preview.revision)} />
          <label>
            <input type="checkbox" name="confirmed" value="yes" required />{' '}
            I reviewed all nine players and confirm this exact lineup and revision.
          </label>
          <button type="submit">Confirm lineup and schedule</button>
        </form>
      ) : null}
      {preview.status === 'scheduled'
        && scheduledPlayersResolved
        && process.env.OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED === 'true' ? (
          <form method="post" action="/admin/daily/editions/review/issue">
            <input type="hidden" name="occurrenceId" value={preview.occurrenceId} />
            <input type="hidden" name="expectedRevision" value={String(preview.revision)} />
            <p>Issuance permanently freezes this lineup's clues and immutable publication identity.
              It does not enable public gameplay or competitive scoring.</p>
            <label>
              <input type="checkbox" name="confirmed" value="yes" required />{' '}
              I reviewed the scheduled nine players and authorize issuance of this exact revision.
            </label>
            <button type="submit">Confirm and issue immutable edition</button>
          </form>
        ) : null}
    </section>
  );
}

/** Restricted secondary lineup review with independent revision-bound actions. */
export default async function OfficialDailyEditionReviewPage({
  searchParams,
}: {
  searchParams: Promise<Parameters>;
}): Promise<JSX.Element> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') notFound();

  let fetchSite: string | null = null;
  try {
    const requestHeaders = await headers();
    requireDailyAdminPrincipal(requestHeaders.get('authorization'));
    fetchSite = requestHeaders.get('sec-fetch-site');
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      redirect(DAILY_ADMIN_AUTH_PATH);
    }
    return <main className="page-shell"><section className="daily-card">
      <h1>Secondary lineup review unavailable</h1>
      <p>Administrator configuration is unavailable.</p>
    </section></main>;
  }
  if (!isFirstPartyDailyAdminNavigation(fetchSite)) notFound();

  const query = parseReviewQuery(await searchParams);
  const id = query.kind === 'valid' ? query.occurrenceId : query.kind;
  let preview: OfficialDailyDraftPreview | null = null;
  let unavailable = false;
  if (query.kind === 'valid') {
    try {
      preview = await readOfficialDailyEditorialDraftPreview(
        createServerSupabaseClient(), query.occurrenceId,
      );
    } catch {
      unavailable = true;
    }
  }

  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Restricted Daily administration</p>
        <h1>Review secondary Daily lineup</h1>
        <p>Inspect all nine players and clue readiness before a separate,
          revision-checked scheduling action. No public answers appear on this page.</p>
        <form method="get" action="/admin/daily/editions/review">
          <label htmlFor="official-occurrence">Draft occurrence ID</label>
          <input id="official-occurrence" name="occurrenceId"
            defaultValue={id !== 'empty' && id !== 'invalid' ? id : ''}
            style={inputStyle} required />
          <button type="submit">Review lineup</button>
        </form>
        {id === 'invalid' ? <p role="alert">Invalid occurrence ID or query.</p> : null}
        {unavailable ? (
          <p role="alert">Draft review is temporarily unavailable. Refresh the editor
            metadata before taking any scheduling action.</p>
        ) : null}
        {preview !== null ? <EditorialPreview preview={preview}
          selection={preview.status === 'draft' && query.kind === 'valid'
            ? query.selection : null} /> : null}
      </section>
    </main>
  );
}
