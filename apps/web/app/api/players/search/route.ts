import { searchCanonicalPlayers } from '@initial-baseball/engine';
import { NextResponse } from 'next/server';
import { getCanonicalSearchCandidates } from '../../../serverCanonicalData';

// This endpoint serves Daily and the staged Custom creator/player search.
// Reject overlong inputs before materializing and scanning canonical candidates.
// Matches the Custom gameplay client's existing 100-character ceiling.
const MAX_CANONICAL_SEARCH_QUERY_LENGTH = 100;

export function GET(request: Request): NextResponse {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length === 0 || query.length > MAX_CANONICAL_SEARCH_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  return NextResponse.json({ results: searchCanonicalPlayers(query, getCanonicalSearchCandidates()) });
}
