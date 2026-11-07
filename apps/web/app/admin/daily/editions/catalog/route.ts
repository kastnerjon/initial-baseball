import { NextResponse } from 'next/server';
import { validateIssuedDailyCalendarDate } from '@initial-baseball/daily';
import {
  DAILY_ADMIN_AUTH_CHALLENGE,
  DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../../dailyAdminAuthorization';
import { isSameOriginDailyAdminRead } from '../../../../dailyAdminRequestSecurity';
import {
  listPrivateOfficialDailyEditorialDrafts,
  OfficialDailyEditorialCatalogError,
} from '../../../../serverOfficialDailyEditorialCatalog';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';

const HEADERS = { 'cache-control': 'private, no-store', vary: 'Authorization' } as const;
const ALLOWED_PARAMETERS = new Set(['puzzleDate', 'afterEditionNumber', 'pageSize']);

function errorReply(status: number, code: string): NextResponse {
  return NextResponse.json({ error: code }, { status, headers: HEADERS });
}

function optionalNumber(params: URLSearchParams, key: string): number | null | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/** Private, default-OFF date catalog for future editor UI; never selects hidden players. */
export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') {
    return errorReply(404, 'not_found');
  }
  if (!isSameOriginDailyAdminRead(request)) return errorReply(403, 'forbidden');
  try {
    requireDailyAdminPrincipal(request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      const response = errorReply(401, 'authentication_required');
      response.headers.set('www-authenticate', DAILY_ADMIN_AUTH_CHALLENGE);
      return response;
    }
    return errorReply(503, 'unavailable');
  }

  const params = new URL(request.url).searchParams;
  const keys = [...params.keys()];
  if (!keys.every(key => ALLOWED_PARAMETERS.has(key))
      || new Set(keys).size !== keys.length) {
    return errorReply(400, 'invalid_request');
  }
  const puzzleDate = params.get('puzzleDate');
  const afterEditionNumber = optionalNumber(params, 'afterEditionNumber');
  const pageSize = optionalNumber(params, 'pageSize');
  if (!puzzleDate || afterEditionNumber === null || pageSize === null) {
    return errorReply(400, 'invalid_request');
  }
  try { validateIssuedDailyCalendarDate(puzzleDate); }
  catch { return errorReply(400, 'invalid_request'); }

  try {
    const page = await listPrivateOfficialDailyEditorialDrafts(createServerSupabaseClient(), {
      puzzleDate,
      ...(afterEditionNumber === undefined ? {} : { afterEditionNumber }),
      ...(pageSize === undefined ? {} : { pageSize }),
    });
    return NextResponse.json(page, { status: 200, headers: HEADERS });
  } catch (error) {
    if (error instanceof OfficialDailyEditorialCatalogError && error.kind === 'invalid') {
      return errorReply(400, 'invalid_request');
    }
    return errorReply(503, 'unavailable');
  }
}
