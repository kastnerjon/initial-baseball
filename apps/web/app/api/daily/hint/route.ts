import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { requirePublishedDailyDate } from '../../../requirePublishedDailyDate';
import { dailyRuntime } from '../../../serverCanonicalRuntime';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const puzzleDate = requirePublishedDailyDate(body.puzzleDate);
    const pitchNumber = requireInteger(body.pitchNumber, 'pitchNumber');
    const revealCount = requireInteger(body.revealCount, 'revealCount');
    return NextResponse.json(dailyRuntime.revealHint(puzzleDate, pitchNumber, revealCount));
  } catch (error) {
    return errorResponse(error);
  }
}

function requireInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value)) {
    throw new DailyRuntimeRequestError(`${field} must be an integer.`);
  }
  return value as number;
}

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Invalid Daily hint request.';
  const status = error instanceof DailyRuntimeRequestError ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}
