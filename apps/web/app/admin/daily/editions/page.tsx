import React, { type JSX } from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../dailyAdminAuthorization';
import { DAILY_ADMIN_AUTH_PATH } from '../../../dailyAdminPaths';
import { isFirstPartyDailyAdminNavigation } from '../../../dailyAdminRequestSecurity';
import { validateIssuedDailyCalendarDate } from '@initial-baseball/daily';
import {
  listPrivateOfficialDailyEditorialDrafts,
  type PrivateOfficialDailyEditorialPage,
} from '../../../serverOfficialDailyEditorialCatalog';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';

export const dynamic = 'force-dynamic';

type Parameters = Record<string, string | string[] | undefined>;
type Selection = Readonly<{ puzzleDate: string; afterEditionNumber?: number }>;

function parseSelection(params: Parameters): Selection | 'empty' | 'invalid' {
  if (Object.keys(params).some(key => key !== 'puzzleDate' && key !== 'afterEditionNumber')) {
    return 'invalid';
  }
  if (params.puzzleDate === undefined && params.afterEditionNumber === undefined) return 'empty';
  if (typeof params.puzzleDate !== 'string') return 'invalid';
  try { validateIssuedDailyCalendarDate(params.puzzleDate); }
  catch { return 'invalid'; }

  const cursor = params.afterEditionNumber;
  if (cursor === undefined) return { puzzleDate: params.puzzleDate };
  if (typeof cursor !== 'string' || !/^[1-9][0-9]*$/.test(cursor)) return 'invalid';
  const afterEditionNumber = Number(cursor);
  if (!Number.isSafeInteger(afterEditionNumber) || afterEditionNumber > 2147483647) return 'invalid';
  return { puzzleDate: params.puzzleDate, afterEditionNumber };
}

function nextHref(page: PrivateOfficialDailyEditorialPage): string | null {
  if (page.nextCursor === null) return null;
  const query = new URLSearchParams({
    puzzleDate: page.puzzleDate,
    afterEditionNumber: String(page.nextCursor),
  });
  return '/admin/daily/editions?' + query.toString();
}

const cell = { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #ddd' } as const;

/**
 * Server-rendered editor listing only. The gameplay and result admission paths
 * are separate and never follow from a draft being visible in this workbench.
 */
export default async function OfficialDailyEditionAdminPage({
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
      <h1>Secondary edition administration unavailable</h1>
      <p>Administrator configuration is unavailable.</p>
    </section></main>;
  }
  if (!isFirstPartyDailyAdminNavigation(fetchSite)) notFound();

  const selection = parseSelection(await searchParams);
  let page: PrivateOfficialDailyEditorialPage | null = null;
  let unavailable = false;
  if (selection !== 'empty' && selection !== 'invalid') {
    try {
      page = await listPrivateOfficialDailyEditorialDrafts(createServerSupabaseClient(), selection);
    } catch { unavailable = true; }
  }

  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Restricted Daily administration</p>
        <h1>Secondary Daily editions</h1>
        <p>The date catalog shows only edition metadata, not players or clues.
          Creating a draft does not schedule or publish it. The primary Daily remains managed separately.</p>
        <p><a href="/admin/daily">Primary Daily editor</a></p>
        <p><a href="/admin/daily/editions/players">Find canonical player IDs by name</a></p>
        <form action="/admin/daily/editions" method="get">
          <label htmlFor="edition-date">Pacific game date</label>
          <input id="edition-date" type="date" name="puzzleDate"
            defaultValue={selection !== 'empty' && selection !== 'invalid' ? selection.puzzleDate : ''}
            required />
          <button type="submit">View editions</button>
        </form>

        <section aria-label="Create secondary Daily editorial draft">
          <h2>Create a secondary Daily draft</h2>
          <p>Enter nine canonical player IDs in batting order. Creation validates
            the private clues but does not schedule or issue the lineup.
            Review all nine players on the following screen before scheduling.</p>
          <form method="post" action="/admin/daily/editions/create">
            <label htmlFor="new-secondary-date">Future Pacific game date</label>
            <input id="new-secondary-date" name="puzzleDate" type="date"
              defaultValue={selection !== 'empty' && selection !== 'invalid'
                ? selection.puzzleDate : ''} required />
            <label htmlFor="new-secondary-number">Edition number (2 or greater)</label>
            <input id="new-secondary-number" name="editionNumber"
              type="number" min={2} max={2147483647} step={1} required />
            <label htmlFor="new-secondary-key">Edition key</label>
            <input id="new-secondary-key" name="editionKey" required maxLength={64}
              placeholder="modern" />
            <label htmlFor="new-secondary-title">Title (optional)</label>
            <input id="new-secondary-title" name="title" maxLength={60}
              placeholder="Puzzle 2" />
            <ol>
              {Array.from({ length: 9 }, (_, i) => (
                <li key={i}>
                  <label htmlFor={'secondary-player-' + (i + 1)}>
                    Player {i + 1} canonical ID
                  </label>
                  <input id={'secondary-player-' + (i + 1)}
                    name={'canonicalPlayerId' + (i + 1)}
                    required autoComplete="off" />
                </li>
              ))}
            </ol>
            <button type="submit">Save draft and review players</button>
          </form>
        </section>

        {selection === 'invalid' ? <p role="alert">Invalid date or page cursor.</p> : null}
        {unavailable ? <p role="alert">Edition metadata is temporarily unavailable.</p> : null}
        {page !== null ? (
          <section aria-label="Secondary editorial editions">
            <h2>{page.puzzleDate} · Secondary editions</h2>
            {page.editions.length === 0 ? <p>No editions on this page.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                  <thead>
                    <tr>{['Edition', 'Title', 'Status', 'Revision', 'Occurrence ID', 'Review'].map(label =>
                      <th key={label} scope="col" style={cell}>{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {page.editions.map(item => (
                      <tr key={item.occurrenceId}>
                        <td style={cell}>{item.editionNumber}</td>
                        <td style={cell}>{item.title}</td>
                        <td style={cell}>{item.status}</td>
                        <td style={cell}>{item.revision}</td>
                        <td style={cell}><code>{item.occurrenceId}</code></td>
                        <td style={cell}><a href={'/admin/daily/editions/review?occurrenceId=' + encodeURIComponent(item.occurrenceId)}>Review nine players</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {nextHref(page) !== null ? (
              <p><a href={nextHref(page)!}>Next editions</a></p>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
