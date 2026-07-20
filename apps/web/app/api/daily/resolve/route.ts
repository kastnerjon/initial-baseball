import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { requirePublishedDailyDate } from '../../../requirePublishedDailyDate';
import { dailyRuntime } from '../../../serverCanonicalRuntime';

export const preferredRegion = 'iad1';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const giveUp = body.giveUp === true;
    const submittedPlayerId = typeof body.submittedPlayerId === 'string'
      ? body.submittedPlayerId
      : undefined;

    return NextResponse.json(await dailyRuntime.resolveAtBat({
      puzzleDate: requirePublishedDailyDate(body.puzzleDate),
      progressionToken: requireProgressionToken(body.progressionToken),
      ...(submittedPlayerId === undefined ? {} : { submittedPlayerId }),
      ...(giveUp ? { giveUp: true } : {}),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Daily resolution request.';
    const status = error instanceof DailyRuntimeRequestError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function requireProgressionToken(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DailyRuntimeRequestError('progressionToken is required.');
  }
  return value;
}
