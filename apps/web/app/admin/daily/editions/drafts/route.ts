import { NextResponse } from 'next/server';
import {
  DAILY_ADMIN_AUTH_CHALLENGE, DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../../dailyAdminAuthorization';
import { isSameOriginDailyAdminMutation } from '../../../../dailyAdminRequestSecurity';
import { readDailyResultJsonBody } from '../../../../dailyResultRequestBody';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';
import {
  createOfficialDailyEditorialDraft, OfficialDailyDraftError,
  scheduleOfficialDailyEditorialDraft,
} from '../../../../serverOfficialDailyEditorialDrafts';

const HEADERS = { 'cache-control': 'private, no-store' } as const;
const BODY_LIMIT = 8192;
type Action = 'create' | 'schedule';

/** Return a private error envelope without exposing input or provider failures. */
function reply(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: HEADERS });
}

/** Restricted editorial staging only. This API does not publish or expose clues. */
async function mutate(request: Request, action: Action): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') {
    return reply(404, 'not_found');
  }
  if (!isSameOriginDailyAdminMutation(request)) return reply(403, 'forbidden');
  const url = new URL(request.url);
  if (url.search !== '' || request.headers.get('content-type')?.split(';', 1)[0]
      ?.trim().toLowerCase() !== 'application/json') return reply(415, 'invalid_content_type');

  let actorId: string;
  try {
    actorId = requireDailyAdminPrincipal(request.headers.get('authorization')).actorId;
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError) {
      if (error.kind === 'misconfigured') return reply(503, 'unavailable');
      const response = reply(401, 'authentication_required');
      response.headers.set('www-authenticate', DAILY_ADMIN_AUTH_CHALLENGE);
      return response;
    }
    return reply(503, 'unavailable');
  }

  const body = await readDailyResultJsonBody(request, BODY_LIMIT);
  if (!body.ok) return reply(body.error === 'payload_too_large' ? 413 : 400, 'invalid_request');
  try {
    const client = createServerSupabaseClient();
    if (action === 'create') {
      const result = await createOfficialDailyEditorialDraft(client, body.value, actorId);
      return NextResponse.json(result, { status: result.status === 'created' ? 201 : 200,
        headers: HEADERS });
    }
    const value = body.value;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return reply(400, 'invalid_request');
    }
    const fields = value as Record<string, unknown>;
    if (Object.keys(fields).length !== 2
        || !Object.hasOwn(fields, 'occurrenceId')
        || !Object.hasOwn(fields, 'expectedRevision')) return reply(400, 'invalid_request');
    const result = await scheduleOfficialDailyEditorialDraft(
      client, fields.occurrenceId as string, fields.expectedRevision as number, actorId,
    );
    return NextResponse.json(result, { status: 200, headers: HEADERS });
  } catch (error) {
    if (error instanceof OfficialDailyDraftError) {
      return reply(error.kind === 'invalid' ? 400 : error.kind === 'conflict' ? 409 : 503,
        error.kind === 'invalid' ? 'invalid_request'
          : error.kind === 'conflict' ? 'editorial_conflict' : 'unavailable');
    }
    // Never reflect provider failures, future canonical player IDs, or hint values.
    return reply(503, 'unavailable');
  }
}

/** Create one future secondary Daily editorial draft. */
export async function POST(request: Request) { return mutate(request, 'create'); }
/** Schedule an existing draft using an explicit expected revision. */
export async function PATCH(request: Request) { return mutate(request, 'schedule'); }
