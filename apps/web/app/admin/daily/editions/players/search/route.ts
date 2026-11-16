import { NextResponse } from 'next/server';
import { DAILY_ADMIN_AUTH_CHALLENGE, DailyAdminAuthorizationError,
  requireDailyAdminPrincipal } from '../../../../../dailyAdminAuthorization';
import { readBoundedDailyAdminFormText } from '../../../../../dailyAdminBoundedForm';
import { isFirstPartyDailyAdminForm } from '../../../../../dailyAdminRequestSecurity';
import { createDailyAdminContext } from '../../../../../dailyAdminComposition';
import { createDailyAdminWorkflow } from '../../../../../dailyAdminWorkflow';

const HEADERS = { 'cache-control': 'private, no-store', vary: 'Authorization',
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } as const;
function reply(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: HEADERS });
}

/** Read-only player lookup. Search text is carried in the body, never the URL. */
export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') return reply(404, 'not_found');
  if (!isFirstPartyDailyAdminForm(request)) return reply(403, 'forbidden');
  if (new URL(request.url).search !== '' ||
      request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
        !== 'application/x-www-form-urlencoded') return reply(415, 'invalid_request');
  const authorization = request.headers.get('authorization');
  try { requireDailyAdminPrincipal(authorization); }
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
  const fields = new URLSearchParams(text);
  const keys = [...fields.keys()];
  const raw = fields.get('q');
  if (keys.length !== 1 || keys[0] !== 'q' || raw === null || raw.length > 80
      || /[\u0000-\u001f\u007f]/.test(raw) || raw.trim().length < 2)
    return reply(400, 'invalid_request');
  try {
    const { repository } = createDailyAdminContext({ authorizationHeader: authorization });
    const found = createDailyAdminWorkflow(repository).searchPlayers(raw.trim());
    const results = found.slice(0, 25).map(player => ({
      canonicalPlayerId: player.canonicalPlayerId,
      displayName: player.displayName,
      yearsPlayedDisplay: player.yearsPlayedDisplay,
      requiresYearDisambiguation: player.requiresYearDisambiguation,
      primaryPosition: player.primaryPosition,
      revealReady: player.revealReady,
    }));
    return NextResponse.json({ results, hasMore: found.length > 25 }, { headers: HEADERS });
  } catch { return reply(503, 'unavailable'); }
}
