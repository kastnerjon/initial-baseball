import { searchCanonicalPlayers } from '@initial-baseball/engine';
import { NextResponse } from 'next/server';
import { getCanonicalSearchCandidates } from '../../../serverCanonicalData';
import { getCanonicalDailyPlayer } from '../../../canonicalDailyPlayerLookup';

// This endpoint serves Daily and the staged Custom creator/player search.
// Reject overlong inputs before materializing and scanning canonical candidates.
// Matches the Custom gameplay client's existing 100-character ceiling.
const MAX_CANONICAL_SEARCH_QUERY_LENGTH = 100;

// The creator must not offer indexed players that its authoritative immutable
// clue issuer cannot resolve. Cache this slice; Daily/Classic guessing still
// searches the unchanged complete canonical index.
let customCreatorCandidates: ReturnType<typeof getCanonicalSearchCandidates> | null = null;
function getCustomCreatorCandidates() {
  customCreatorCandidates ??= getCanonicalSearchCandidates()
    .filter(({ id }) => getCanonicalDailyPlayer(id) !== null);
  return customCreatorCandidates;
}


export function GET(request: Request): NextResponse {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length === 0 || query.length > MAX_CANONICAL_SEARCH_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  const candidates = new URL(request.url).searchParams.get('scope') === 'custom-creator'
    ? getCustomCreatorCandidates()
    : getCanonicalSearchCandidates();
  return NextResponse.json({ results: searchCanonicalPlayers(query, candidates) });
}
