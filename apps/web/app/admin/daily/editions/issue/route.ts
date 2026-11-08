import { NextResponse } from 'next/server';
import {
  DAILY_ADMIN_AUTH_CHALLENGE,
  DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../../dailyAdminAuthorization';
import { isSameOriginDailyAdminMutation } from '../../../../dailyAdminRequestSecurity';
import { readDailyResultJsonBody } from '../../../../dailyResultRequestBody';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';
import { OfficialDailyIssueError, issuePrivateOfficialDaily } from '../../../../serverOfficialDailyIssuance';

const HEADERS = { 'cache-control': 'private, no-store' } as const;
/** Return only an answer-free, noncacheable error envelope. */
function failure(status: number, code: string) {
  return NextResponse.json({ error: code }, { status, headers: HEADERS });
}

/**
 * Restricted, explicitly enabled editor command. Never exposes frozen clues,
 * creates a public puzzle response, or modifies the legacy primary Daily.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true'
      || process.env.OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED !== 'true') {
    return failure(404, 'not_found');
  }
  if (!isSameOriginDailyAdminMutation(request)) return failure(403, 'forbidden');
  if (new URL(request.url).search !== ''
      || request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
        !== 'application/json') return failure(415, 'invalid_content_type');

  try {
    requireDailyAdminPrincipal(request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError
        && error.kind === 'unauthorized') {
      const response = failure(401, 'authentication_required');
      response.headers.set('www-authenticate', DAILY_ADMIN_AUTH_CHALLENGE);
      return response;
    }
    return failure(503, 'unavailable');
  }

  const body = await readDailyResultJsonBody(request, 2048);
  if (!body.ok) return failure(body.error === 'payload_too_large' ? 413 : 400, 'invalid_request');
  if (body.value === null || typeof body.value !== 'object' || Array.isArray(body.value)) {
    return failure(400, 'invalid_request');
  }
  const input = body.value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || !Object.hasOwn(input, 'occurrenceId')
      || !Object.hasOwn(input, 'expectedRevision')
      || typeof input.occurrenceId !== 'string'
      || typeof input.expectedRevision !== 'number') return failure(400, 'invalid_request');
  try {
    const issued = await issuePrivateOfficialDaily(
      createServerSupabaseClient(), input.occurrenceId, input.expectedRevision,
    );
    return NextResponse.json(issued, {
      status: issued.status === 'created' ? 201 : 200, headers: HEADERS,
    });
  } catch (error) {
    if (error instanceof OfficialDailyIssueError) {
      return failure(error.kind === 'invalid' ? 400
        : error.kind === 'conflict' ? 409 : 503,
        error.kind === 'invalid' ? 'invalid_request'
          : error.kind === 'conflict' ? 'editorial_conflict' : 'unavailable');
    }
    // No database/answer-bearing error or hidden puzzle content is serialized.
    return failure(503, 'unavailable');
  }
}
