import { searchCanonicalPlayers } from '@initial-baseball/engine';
import { NextResponse } from 'next/server';
import { getCanonicalSearchCandidates } from '../../../serverCanonicalData';

export function GET(request: Request): NextResponse {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length === 0) {
    return NextResponse.json({ results: [] });
  }

  return NextResponse.json({ results: searchCanonicalPlayers(query, getCanonicalSearchCandidates()) });
}
