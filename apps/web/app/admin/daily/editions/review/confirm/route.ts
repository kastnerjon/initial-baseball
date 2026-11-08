import { NextResponse } from 'next/server';
import { isOfficialDailyOccurrenceId } from '@initial-baseball/daily';
import {
  DAILY_ADMIN_AUTH_CHALLENGE, DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../../../dailyAdminAuthorization';
import { isFirstPartyDailyAdminForm } from '../../../../../dailyAdminRequestSecurity';
import { readBoundedDailyAdminFormText } from '../../../../../dailyAdminBoundedForm';
import {
  OfficialDailyDraftError, scheduleOfficialDailyEditorialDraft,
} from '../../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../../serverSupabaseClient';

const MAX_FORM_BYTES = 1024;
const HEADERS = {
  'cache-control': 'private, no-store',
  vary: 'Authorization',
  'x-content-type-options': 'nosniff',
} as const;
function reply(status: number, code: string): NextResponse {
  return NextResponse.json({ error: code }, { status, headers: HEADERS });
}

type Confirmed = { occurrenceId: string; expectedRevision: number };
function parseConfirmedForm(text: string): Confirmed | null {
  const params = new URLSearchParams(text);
  const keys = [...params.keys()];
  if (keys.length !== 3 || new Set(keys).size !== keys.length
    || !['occurrenceId', 'expectedRevision', 'confirmed']
      .every(key => keys.includes(key))) return null;
  const occurrenceId = params.get('occurrenceId');
  const rawRevision = params.get('expectedRevision');
  if (!isOfficialDailyOccurrenceId(occurrenceId)
    || !rawRevision || !/^(0|[1-9][0-9]{0,14})$/.test(rawRevision)
    || params.get('confirmed') !== 'yes') return null;
  const expectedRevision = Number(rawRevision);
  if (!Number.isSafeInteger(expectedRevision)) return null;
  return { occurrenceId, expectedRevision };
}

/** Explicit editor confirmation; existing backend owns revision-CAS scheduling. */
export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') {
    return reply(404, 'not_found');
  }
  if (!isFirstPartyDailyAdminForm(request)) return reply(403, 'forbidden');
  if (new URL(request.url).search !== '' ||
      request.headers.get('content-type')?.split(';', 1)[0]
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

  const text = await readBoundedDailyAdminFormText(request, MAX_FORM_BYTES);
  if (text === null) return reply(413, 'invalid_request');
  const confirmed = parseConfirmedForm(text);
  if (confirmed === null) return reply(400, 'invalid_request');
  try {
    await scheduleOfficialDailyEditorialDraft(
      createServerSupabaseClient(), confirmed.occurrenceId,
      confirmed.expectedRevision, actorId,
    );
    const destination = new URL('/admin/daily/editions/review', request.url);
    destination.searchParams.set('occurrenceId', confirmed.occurrenceId);
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
