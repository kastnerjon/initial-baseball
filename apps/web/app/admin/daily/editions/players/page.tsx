import React, { type JSX } from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  DailyAdminAuthorizationError, requireDailyAdminPrincipal,
} from '../../../../dailyAdminAuthorization';
import { DAILY_ADMIN_AUTH_PATH } from '../../../../dailyAdminPaths';
import { isFirstPartyDailyAdminNavigation } from '../../../../dailyAdminRequestSecurity';
import { createDailyAdminContext } from '../../../../dailyAdminComposition';
import { createDailyAdminWorkflow, type DailyAdminPlayerSearchResult } from '../../../../dailyAdminWorkflow';

export const dynamic = 'force-dynamic';
const MAX_MATCHES = 25;
type SearchParams = Record<string, string | string[] | undefined>;

function parseSearch(params: SearchParams): string | 'invalid' {
  if (Object.keys(params).some(key => key !== 'q') || typeof params.q === 'object') return 'invalid';
  if (params.q === undefined) return '';
  if (typeof params.q !== 'string' || params.q.length > 80
      || /[\u0000-\u001f\u007f]/.test(params.q)) return 'invalid';
  const query = params.q.trim();
  if (query.length > 0 && query.length < 2) return 'invalid';
  return query;
}

/**
 * Restricted, metadata-only canonical player search.
 * Reuses the existing primary Daily editor candidate search, never hints or answers.
 */
export default async function OfficialDailyEditorPlayerSearchPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }): Promise<JSX.Element> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') notFound();
  let authorization: string | null = null;
  let fetchSite: string | null = null;
  try {
    const requestHeaders = await headers();
    authorization = requestHeaders.get('authorization');
    fetchSite = requestHeaders.get('sec-fetch-site');
    requireDailyAdminPrincipal(authorization);
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      redirect(DAILY_ADMIN_AUTH_PATH);
    }
    return <main className="page-shell"><section className="daily-card">
      <h1>Player search unavailable</h1>
    </section></main>;
  }
  if (!isFirstPartyDailyAdminNavigation(fetchSite)) notFound();

  const query = parseSearch(await searchParams);
  let results: readonly DailyAdminPlayerSearchResult[] = [];
  let unavailable = false;
  if (query !== 'invalid' && query.length > 0) {
    try {
      const { repository } = createDailyAdminContext({ authorizationHeader: authorization });
      results = createDailyAdminWorkflow(repository).searchPlayers(query);
    } catch { unavailable = true; }
  }

  return <main className="page-shell"><section className="daily-card">
    <p className="eyebrow">Restricted Daily administration</p>
    <h1>Find a canonical Daily player</h1>
    <p>Search names or aliases in the existing Daily editorial candidate catalog.
      Copy a canonical ID into the new edition draft or player-replacement form.
      Player clues and unpublished lineups are never displayed here.</p>
    <p><a href="/admin/daily/editions">Return to secondary editions</a></p>
    <form method="get" action="/admin/daily/editions/players">
      <label htmlFor="secondary-search-q">Player name or alias</label>
      <input id="secondary-search-q" name="q" type="search"
        maxLength={80} defaultValue={query === 'invalid' ? '' : query} required />
      <button type="submit">Find players</button>
    </form>
    {query === 'invalid' ? <p role="alert">Invalid player search.</p> : null}
    {unavailable ? <p role="alert">Player search is temporarily unavailable.</p> : null}
    {query !== 'invalid' && query.length > 0 && !unavailable ? (
      <section aria-label="Canonical player search results">
        <h2>Matching candidates</h2>
        {results.length === 0 ? <p>No matching Daily candidates.</p> : null}
        {results.length > MAX_MATCHES ? <p>Showing the first {MAX_MATCHES} matches.
          Refine the search to find a specific player.</p> : null}
        <ol>
          {results.slice(0, MAX_MATCHES).map(player => (
            <li key={player.canonicalPlayerId}>
              <strong>{player.displayName}</strong>{player.requiresYearDisambiguation
                ? ' (' + player.yearsPlayedDisplay + ')' : ''}
              {' · '}{player.primaryPosition}{' · '}
              {player.revealReady ? 'Clue-ready' : 'Clue material unavailable'}
              <div><code>{player.canonicalPlayerId}</code></div>
            </li>
          ))}
        </ol>
      </section>
    ) : null}
  </section></main>;
}
