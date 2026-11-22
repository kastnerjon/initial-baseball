import { NextRequest, NextResponse } from 'next/server';
import {
  creatorAuthClient, creatorAuthForm, creatorAuthResponse,
  inspectCreatorAccountSession, sameOriginPost,
} from '../../../../serverCreatorAccountAuth';
import {
  inspectOfficialDailyOAuthDetails, readOfficialDailyMcpConsentConfig,
  validOfficialDailyOAuthAuthorizationId, validOfficialDailyOAuthRedirect,
} from '../../../../officialDailyMcpConsent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = {
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};
function fail(status: number) {
  return creatorAuthResponse(NextResponse.json(
    { error: status === 404 ? 'not_found' : status === 403 ? 'forbidden' : status === 405 ? 'method_not_allowed' : 'unavailable' },
    { status, headers: HEADERS },
  ));
}
export async function POST(request: NextRequest): Promise<NextResponse> {
  const config = readOfficialDailyMcpConsentConfig();
  if (!config || request.nextUrl.origin !== config.creator.origin
      || request.headers.get('host') !== new URL(config.creator.origin).host) return fail(404);
  if (!sameOriginPost(request)) return fail(403);
  const form = await creatorAuthForm(request);
  const authorizationId = form?.get('authorization_id');
  const decision = form?.get('decision');
  if (!form || form.size !== 2
      || !validOfficialDailyOAuthAuthorizationId(authorizationId)
      || (decision !== 'approve' && decision !== 'deny')) return fail(400);
  const auth = creatorAuthClient(request, config.creator);
  const session = await inspectCreatorAccountSession(auth.client);
  if (session.kind !== 'verified' || session.id !== config.editorId) return auth.finish(fail(403));
  try {
    // The hidden form field is untrusted: re-read exact client, editor, callback and scopes immediately before deciding.
    const { data, error } = await auth.client.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || inspectOfficialDailyOAuthDetails(data, authorizationId, config)?.kind !== 'consent')
      return auth.finish(fail(403));
    const result = decision === 'approve'
      ? await auth.client.auth.oauth.approveAuthorization(authorizationId)
      : await auth.client.auth.oauth.denyAuthorization(authorizationId);
    if (result.error || !validOfficialDailyOAuthRedirect(result.data?.redirect_url, config.callback))
      return auth.finish(fail(503));
    return auth.finish(NextResponse.redirect(result.data.redirect_url, 303));
  } catch { return auth.finish(fail(503)); }
}

/** Unsupported methods stay invisible until the independently enabled consent boundary is configured. */
export async function GET(): Promise<NextResponse> {
  return fail(readOfficialDailyMcpConsentConfig() ? 405 : 404);
}
export const DELETE = GET;
