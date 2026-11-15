import { NextResponse } from 'next/server';
import { isOfficialDailyOccurrenceId } from '@initial-baseball/daily';
import { DAILY_ADMIN_AUTH_CHALLENGE, DailyAdminAuthorizationError,
  requireDailyAdminPrincipal } from '../../../../../dailyAdminAuthorization';
import { readBoundedDailyAdminFormText } from '../../../../../dailyAdminBoundedForm';
import { isFirstPartyDailyAdminForm } from '../../../../../dailyAdminRequestSecurity';
import { OfficialDailyDraftError, replaceOfficialDailyEditorialDraftPlayer
} from '../../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../../serverSupabaseClient';

const HEADERS = { 'cache-control': 'private, no-store', vary: 'Authorization',
  'x-content-type-options': 'nosniff' } as const;
function reply(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: HEADERS });
}

function parseForm(text: string): {
  occurrenceId: string; expectedRevision: number; slot: number; canonicalPlayerId: string;
} | null {
  const fields = new URLSearchParams(text);
  const keys = [...fields.keys()];
  if (keys.length !== 4 || new Set(keys).size !== keys.length ||
      !['occurrenceId', 'expectedRevision', 'slot', 'canonicalPlayerId']
        .every(name => keys.includes(name))) return null;
  const occurrenceId = fields.get('occurrenceId');
  const revision = fields.get('expectedRevision');
  const slot = fields.get('slot');
  const canonicalPlayerId = fields.get('canonicalPlayerId');
  if (!isOfficialDailyOccurrenceId(occurrenceId)
      || !revision || !/^(0|[1-9][0-9]{0,14})$/.test(revision)
      || !slot || !/^[1-9]$/.test(slot)
      || !canonicalPlayerId || canonicalPlayerId.length > 200
      || canonicalPlayerId.trim() !== canonicalPlayerId) return null;
  const expectedRevision = Number(revision);
  if (!Number.isSafeInteger(expectedRevision)) return null;
  return { occurrenceId, expectedRevision, slot: Number(slot), canonicalPlayerId };
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') return reply(404, 'not_found');
  if (!isFirstPartyDailyAdminForm(request)) return reply(403, 'forbidden');
  if (new URL(request.url).search !== '' ||
      request.headers.get('content-type')?.split(';', 1)[0]
        ?.trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
    return reply(415, 'invalid_content_type');
  }
  let actorId: string;
  try { actorId = requireDailyAdminPrincipal(request.headers.get('authorization')).actorId; }
  catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      const response = reply(401, 'authentication_required');
      response.headers.set('www-authenticate', DAILY_ADMIN_AUTH_CHALLENGE);
      return response;
    }
    return reply(503, 'unavailable');
  }
  const text = await readBoundedDailyAdminFormText(request, 1024);
  if (text === null) return reply(413, 'invalid_request');
  const input = parseForm(text);
  if (input === null) return reply(400, 'invalid_request');
  try {
    await replaceOfficialDailyEditorialDraftPlayer(createServerSupabaseClient(),
      input.occurrenceId, input.expectedRevision, input.slot, input.canonicalPlayerId, actorId);
    const destination = new URL('/admin/daily/editions/review', request.url);
    destination.searchParams.set('occurrenceId', input.occurrenceId);
    return NextResponse.redirect(destination, { status: 303, headers: HEADERS });
  } catch (error) {
    if (error instanceof OfficialDailyDraftError) {
      return reply(error.kind === 'invalid' ? 400 : error.kind === 'conflict' ? 409 : 503,
        error.kind === 'invalid' ? 'invalid_request'
          : error.kind === 'conflict' ? 'editorial_conflict' : 'unavailable');
    }
    return reply(503, 'unavailable');
  }
}
