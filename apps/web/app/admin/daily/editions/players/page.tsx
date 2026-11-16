import React, { type JSX } from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { DailyAdminAuthorizationError, requireDailyAdminPrincipal } from '../../../../dailyAdminAuthorization';
import { DAILY_ADMIN_AUTH_PATH } from '../../../../dailyAdminPaths';
import { isFirstPartyDailyAdminNavigation } from '../../../../dailyAdminRequestSecurity';
import PrivatePlayerLookup from './PrivatePlayerLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

/** Authorized identity lookup; player queries are never placed in navigation URLs. */
export default async function OfficialDailyEditorPlayerSearchPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }): Promise<JSX.Element> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') notFound();
  let fetchSite: string | null = null;
  try {
    const requestHeaders = await headers();
    requireDailyAdminPrincipal(requestHeaders.get('authorization'));
    fetchSite = requestHeaders.get('sec-fetch-site');
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized')
      redirect(DAILY_ADMIN_AUTH_PATH);
    return <main className="page-shell"><section className="daily-card">
      <h1>Player search unavailable</h1>
    </section></main>;
  }
  if (!isFirstPartyDailyAdminNavigation(fetchSite)) notFound();
  // Refuse old query-based links rather than performing or echoing a sensitive lookup.
  if (Object.keys(await searchParams).length !== 0) notFound();
  return <main className="page-shell"><section className="daily-card">
    <p className="eyebrow">Restricted Daily administration</p>
    <h1>Find a canonical Daily player</h1>
    <p>Search names or aliases, then copy a canonical ID into the new edition draft.
      Player clues and unpublished lineups are not displayed here.</p>
    <p><a href="/admin/daily/editions">Return to secondary editions</a></p>
    <PrivatePlayerLookup />
  </section></main>;
}
