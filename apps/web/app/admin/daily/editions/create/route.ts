import { NextResponse } from 'next/server';
import {
  DAILY_ADMIN_AUTH_CHALLENGE, DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../../dailyAdminAuthorization';
import { readBoundedDailyAdminFormText } from '../../../../dailyAdminBoundedForm';
import { isFirstPartyDailyAdminForm } from '../../../../dailyAdminRequestSecurity';
import {
  createOfficialDailyEditorialDraft, OfficialDailyDraftError,
} from '../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';

const BODY_LIMIT = 4096;
const HEADERS = {
  'cache-control': 'private, no-store',
  vary: 'Authorization',
  'x-content-type-options': 'nosniff',
} as const;
const FIELDS = ['puzzleDate', 'editionKey', 'editionNumber', 'title',
  ...Array.from({ length: 9 }, (_, i) => 'canonicalPlayerId' + (i + 1))];

function reply(status: number, code: string): NextResponse {
  return NextResponse.json({ error: code }, { status, headers: HEADERS });
}

/**
 * Parse an exact, one-roster admin form. The canonical writer remains the
 * authority for calendar, uniqueness, nine-slot and clue readiness rules.
 */
function parseCreateForm(text: string): Record<string, unknown> | null {
  const params = new URLSearchParams(text);
  const fields = [...params.keys()];
  if (fields.length !== FIELDS.length || new Set(fields).size !== fields.length
      || !FIELDS.every(field => fields.includes(field))) return null;
  const rawEdition = params.get('editionNumber');
  if (!rawEdition || !/^[1-9][0-9]{0,9}$/.test(rawEdition)) return null;
  const editionNumber = Number(rawEdition);
  if (!Number.isSafeInteger(editionNumber) || editionNumber < 2
      || editionNumber > 2147483647) return null;
  const puzzleDate = params.get('puzzleDate');
  const editionKey = params.get('editionKey');
  const title = params.get('title');
  const canonicalPlayerIds = Array.from({ length: 9 },
    (_, index) => params.get('canonicalPlayerId' + (index + 1)));
  if (!puzzleDate || !editionKey || title === null
      || canonicalPlayerIds.some(value => value === null || value === '')) return null;
  return {
    puzzleDate, editionKey, editionNumber,
    ...(title === '' ? {} : { title }),
    canonicalPlayerIds,
  };
}

/** Create one future nine-player editorial draft, not a scheduled or issued game. */
export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') {
    return reply(404, 'not_found');
  }
  if (!isFirstPartyDailyAdminForm(request)) return reply(403, 'forbidden');
  if (new URL(request.url).search !== ''
      || request.headers.get('content-type')?.split(';', 1)[0]
        ?.trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
    return reply(415, 'invalid_content_type');
  }

  let actorId: string;
  try {
    actorId = requireDailyAdminPrincipal(request.headers.get('authorization')).actorId;
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      const response = reply(401, 'authentication_required');
      response.headers.set('www-authenticate', DAILY_ADMIN_AUTH_CHALLENGE);
      return response;
    }
    return reply(503, 'unavailable');
  }

  const text = await readBoundedDailyAdminFormText(request, BODY_LIMIT);
  if (text === null) return reply(413, 'invalid_request');
  const input = parseCreateForm(text);
  if (input === null) return reply(400, 'invalid_request');

  try {
    const result = await createOfficialDailyEditorialDraft(
      createServerSupabaseClient(), input, actorId,
    );
    const destination = new URL('/admin/daily/editions/review', request.url);
    destination.searchParams.set('occurrenceId', result.occurrenceId);
    return NextResponse.redirect(destination, { status: 303, headers: HEADERS });
  } catch (error) {
    if (error instanceof OfficialDailyDraftError) {
      return reply(error.kind === 'invalid' ? 400
        : error.kind === 'conflict' ? 409 : 503,
      error.kind === 'invalid' ? 'invalid_request'
        : error.kind === 'conflict' ? 'editorial_conflict' : 'unavailable');
    }
    return reply(503, 'unavailable');
  }
}
