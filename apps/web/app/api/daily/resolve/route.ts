import { NextResponse } from 'next/server';
import type { DailyRevealCount } from '@initial-baseball/shared';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { requirePublishedDailyDate } from '../../../requirePublishedDailyDate';
import { dailyRuntime } from '../../../serverCanonicalRuntime';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const revealCount = requireRangeInteger(body.revealCount, 'revealCount', 0, 4) as DailyRevealCount;
    const giveUp = body.giveUp === true;
    const submittedPlayerId = typeof body.submittedPlayerId === 'string'
      ? body.submittedPlayerId
      : undefined;
    return NextResponse.json(dailyRuntime.resolveAtBat({
      puzzleDate: requirePublishedDailyDate(body.puzzleDate),
      pitchNumber: requireRangeInteger(body.pitchNumber, 'pitchNumber', 1, 9),
      revealCount,
      strikeCount: requireRangeInteger(body.strikeCount, 'strikeCount', 0, 2),
      ...(submittedPlayerId === undefined ? {} : { submittedPlayerId }),
      ...(giveUp ? { giveUp: true } : {}),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Daily resolution request.';
    const status = error instanceof DailyRuntimeRequestError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function requireRangeInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new DailyRuntimeRequestError(`${field} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value as number;
}
