import { validateIssuedDailyCalendarDate } from '@initial-baseball/daily';
import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from '../../../../../dailyRuntimeService';
import { createServerOfficialDailyEditionRuntime } from '../../../../../serverOfficialDailyEditionRuntime';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ puzzleId: string; action: string }> };
type Action = 'bootstrap' | 'hints' | 'hint' | 'resolve';

function respond(value: unknown, status = 200): NextResponse {
  return NextResponse.json(value, {
    status,
    headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  });
}

function invalid(): never {
  throw new DailyRuntimeRequestError('Invalid official Daily edition request.');
}

function parseToken(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) invalid();
  return value;
}

function parseBody(value: unknown, action: Action) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();
  if (action === 'hints' || action === 'hint') {
    if (keys.join(',') !== 'progressionToken') invalid();
    return { progressionToken: parseToken(body.progressionToken) };
  }
  if (action !== 'resolve') invalid();
  if (keys.join(',') === 'giveUp,progressionToken' && body.giveUp === true) {
    return { progressionToken: parseToken(body.progressionToken), giveUp: true as const };
  }
  if (keys.join(',') === 'progressionToken,submittedPlayerId'
      && typeof body.submittedPlayerId === 'string'
      && body.submittedPlayerId.length > 0 && body.submittedPlayerId.length <= 100) {
    return {
      progressionToken: parseToken(body.progressionToken),
      submittedPlayerId: body.submittedPlayerId,
    };
  }
  invalid();
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof DailyRuntimeRequestError) {
    return error.message === 'Official Daily edition unavailable.'
      ? respond({ error: 'not_found' }, 404)
      : respond({ error: 'invalid_request' }, 400);
  }
  return respond({ error: 'unavailable' }, 503);
}

function isAction(value: string): value is Action {
  return value === 'bootstrap' || value === 'hint'
    || value === 'hints' || value === 'resolve';
}

/**
 * Source-staged transport for the shared, exact-ID runtime.
 * Two independent default-OFF flags must be enabled before it can read data.
 * No route here writes results, reserves competitive attempts or confers eligibility.
 */
async function handle(request: Request, context: Context, method: 'GET' | 'POST'): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITION_HTTP_ENABLED !== 'true') {
    return respond({ error: 'not_found' }, 404);
  }
  try {
    const { puzzleId, action } = await context.params;
    if (!isAction(action)) return respond({ error: 'not_found' }, 404);
    if ((action === 'bootstrap') !== (method === 'GET')) {
      return respond({ error: 'method_not_allowed' }, 405);
    }
    const url = new URL(request.url);
    let token: ReturnType<typeof parseBody> | undefined;
    let date: string | undefined;
    if (method === 'GET') {
      if ([...url.searchParams.keys()].join(',') !== 'date') invalid();
      date = url.searchParams.get('date') ?? undefined;
      if (date === undefined) invalid();
      try { validateIssuedDailyCalendarDate(date); } catch { invalid(); }
    } else {
      if (url.search !== '' || request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
        invalid();
      }
      let body: unknown;
      try { body = await request.json(); } catch { invalid(); }
      token = parseBody(body, action);
    }

    const runtime = createServerOfficialDailyEditionRuntime(puzzleId);
    if (action === 'bootstrap') return respond(await runtime.getBootstrap(date!));
    if (action === 'hints') return respond(await runtime.getHintBundle(token!.progressionToken));
    if (action === 'hint') return respond(await runtime.revealHint(token!.progressionToken));
    return respond(await runtime.resolveAtBat(token!));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  return handle(request, context, 'GET');
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  return handle(request, context, 'POST');
}
