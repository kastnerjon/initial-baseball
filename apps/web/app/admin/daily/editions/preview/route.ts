import { NextResponse } from 'next/server';
import { isOfficialDailyOccurrenceId } from '@initial-baseball/daily';
import {
  DAILY_ADMIN_AUTH_CHALLENGE, DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../../dailyAdminAuthorization';
import { isSameOriginDailyAdminMutation } from '../../../../dailyAdminRequestSecurity';
import {
  OfficialDailyDraftError, readOfficialDailyEditorialDraftPreview,
} from '../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';

const HEADERS = {
  'cache-control': 'private, no-store',
  vary: 'Authorization',
  'x-content-type-options': 'nosniff',
} as const;
function reply(status: number, code: string): NextResponse {
  return NextResponse.json({ error: code }, { status, headers: HEADERS });
}

/** The roster is visible only to the authenticated editor, never gameplay clients. */
export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') {
    return reply(404, 'not_found');
  }
  if (!isSameOriginDailyAdminMutation(request)) return reply(403, 'forbidden');
  try {
    requireDailyAdminPrincipal(request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      const response = reply(401, 'authentication_required');
      response.headers.set('www-authenticate', DAILY_ADMIN_AUTH_CHALLENGE);
      return response;
    }
    return reply(503, 'unavailable');
  }
  const params = new URL(request.url).searchParams;
  const keys = [...params.keys()];
  if (keys.length !== 1 || keys[0] !== 'occurrenceId') {
    return reply(400, 'invalid_request');
  }
  const occurrenceId = params.get('occurrenceId');
  if (!isOfficialDailyOccurrenceId(occurrenceId)) {
    return reply(400, 'invalid_request');
  }
  try {
    const result = await readOfficialDailyEditorialDraftPreview(
      createServerSupabaseClient(), occurrenceId,
    );
    return NextResponse.json(result, { status: 200, headers: HEADERS });
  } catch (error) {
    if (error instanceof OfficialDailyDraftError) {
      return reply(error.kind === 'invalid' ? 400
        : error.kind === 'conflict' ? 404 : 503,
      error.kind === 'invalid' ? 'invalid_request'
        : error.kind === 'conflict' ? 'not_found' : 'unavailable');
    }
    return reply(503, 'unavailable');
  }
}
