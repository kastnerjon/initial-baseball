import { NextResponse } from 'next/server';
import type { PlayerSeasonStatRow } from '@initial-baseball/shared';
import generatedSeasonStats from './season-stats.json';

const seasonStats = generatedSeasonStats as Record<string, PlayerSeasonStatRow[]>;

export function GET(request: Request): NextResponse {
  const playerId = new URL(request.url).searchParams.get('playerId')?.trim();

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required.' }, { status: 400 });
  }

  return NextResponse.json({
    playerId,
    seasons: seasonStats[playerId] ?? [],
  });
}
