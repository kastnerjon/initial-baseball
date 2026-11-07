import React, { type JSX } from 'react';
import { headers } from 'next/headers';
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
const inputStyle = { width: '100%', maxWidth: 430 } as const;

function parseOccurrenceId(params: Parameters): string | 'empty' | 'invalid' {
  const keys = Object.keys(params);
  if (keys.length === 0) return 'empty';
  if (keys.length !== 1 || keys[0] !== 'occurrenceId') return 'invalid';
  const id = params.occurrenceId;
  return typeof id === 'string' && isOfficialDailyOccurrenceId(id) ? id : 'invalid';
}

function EditorialPreview({ preview }: { preview: OfficialDailyDraftPreview }) {
  return (
    <section aria-label="Reviewed secondary Daily roster">
      <h2>{preview.title} · Puzzle {preview.editionNumber}</h2>
      <p><strong>Pacific date:</strong> {preview.puzzleDate}</p>
      <p><strong>Edition key:</strong> {preview.editionKey}</p>
      <p><strong>Status:</strong> {preview.status}</p>
      <p><strong>Current editorial revision:</strong> {preview.revision}</p>
      <p><strong>Occurrence ID:</strong> <code>{preview.occurrenceId}</code></p>
      <h3>Selected players (batting order)</h3>
      <ol>
        {preview.selections.map(selection => (
          <li key={selection.slot}>
            <strong>{selection.slot}.</strong>{' '}
            {selection.displayName ?? 'Unresolved player'}
            {' · '}<code>{selection.canonicalPlayerId}</code>
          </li>
        ))}
      </ol>
      <p role="status">
        {preview.canSchedule
          ? 'All nine players have canonical clue material available for scheduling review.'
          : 'This edition is not currently ready to schedule. Check the player records, clues, date and editorial status.'}
      </p>
      <p>This is a read-only review. No scheduling, issuance or public puzzle changes
        occur here. A later confirmation must use this exact occurrence ID and current revision,
        and the server will recheck the clues.</p>
    </section>
  );
}

/** Private read-only secondary lineup inspection; no mutation controls. */
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

  const id = parseOccurrenceId(await searchParams);
  let preview: OfficialDailyDraftPreview | null = null;
  let unavailable = false;
  if (id !== 'empty' && id !== 'invalid') {
    try {
      preview = await readOfficialDailyEditorialDraftPreview(
        createServerSupabaseClient(), id,
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
        {preview !== null ? <EditorialPreview preview={preview} /> : null}
      </section>
    </main>
  );
}
