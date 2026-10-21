import { searchCanonicalPlayers } from '@initial-baseball/engine';
import { NextResponse } from 'next/server';
import { getCanonicalDailyPlayer } from '../../../canonicalDailyPlayerLookup';
import { getCanonicalSearchCandidates } from '../../../serverCanonicalData';

const MAX_QUERY_LENGTH = 100;

// This route is intentionally isolated from ordinary Daily/Classic autocomplete
// so those hot paths do not import the heavyweight issuer player-data map.
let creatorCandidates: ReturnType<typeof getCanonicalSearchCandidates> | null = null;
function getCreatorCandidates() {
  creatorCandidates ??= getCanonicalSearchCandidates()
    .filter(({ id }) => getCanonicalDailyPlayer(id) !== null);
  return creatorCandidates;
}

/** Only offer identities the authoritative Custom clue issuer can resolve. */
export function GET(request: Request): NextResponse {
  if (process.env.CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED !== 'true'
    || process.env.CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED !== 'true') {
    return NextResponse.json({ results: [] }, { status: 404,
      headers: { 'cache-control': 'private, no-store' } });
  }
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length === 0 || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }
  return NextResponse.json({ results: searchCanonicalPlayers(query, getCreatorCandidates()) });
}
