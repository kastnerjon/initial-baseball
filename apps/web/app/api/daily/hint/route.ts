import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { requirePublishedDailyDate } from '../../../requirePublishedDailyDate';
import { dailyRuntime } from '../../../serverCanonicalRuntime';

export const preferredRegion = 'iad1';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    return NextResponse.json(await dailyRuntime.revealHint({
      puzzleDate: requirePublishedDailyDate(body.puzzleDate),
      progressionToken: requireProgressionToken(body.progressionToken),
    }));
  } catch (error) {
    return errorResponse(error);
  }
}

function requireProgressionToken(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DailyRuntimeRequestError('progressionToken is required.');
  }
  return value;
}

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Invalid Daily hint request.';
  const status = error instanceof DailyRuntimeRequestError ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}
