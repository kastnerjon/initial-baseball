import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { dailyRuntime } from '../../../serverCanonicalRuntime';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const giveUp = body.giveUp === true;
    const submittedPlayerId = typeof body.submittedPlayerId === 'string'
      ? body.submittedPlayerId
      : undefined;
    return privateJson(dailyRuntime.resolveAtBat({
      progressionToken: requireProgressionToken(body.progressionToken),
      ...(submittedPlayerId === undefined ? {} : { submittedPlayerId }),
      ...(giveUp ? { giveUp: true } : {}),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Daily resolution request.';
    const status = error instanceof DailyRuntimeRequestError ? 400 : 500;
    return privateJson({ error: message }, { status });
  }
}

function requireProgressionToken(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) {
    throw new DailyRuntimeRequestError('progressionToken is required.');
  }
  return value;
}

function privateJson(value: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(value, init);
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
