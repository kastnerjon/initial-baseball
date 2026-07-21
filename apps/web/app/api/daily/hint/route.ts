import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { dailyRuntime } from '../../../serverCanonicalRuntime';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    return privateJson(await dailyRuntime.revealHint(requireProgressionToken(body.progressionToken)));
  } catch (error) { return errorResponse(error); }
}
function requireProgressionToken(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) throw new DailyRuntimeRequestError('progressionToken is required.');
  return value;
}
function privateJson(value: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(value, init); response.headers.set('cache-control', 'private, no-store'); return response;
}
function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Invalid Daily hint request.';
  return privateJson({ error: message }, { status: error instanceof DailyRuntimeRequestError ? 400 : 500 });
}
