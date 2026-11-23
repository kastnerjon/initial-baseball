import { NextRequest, NextResponse } from 'next/server';
import {
  creatorAuthClient, creatorAuthResponse, inspectCreatorAccountSession,
} from '../../serverCreatorAccountAuth';
import {
  inspectOfficialDailyOAuthDetails, readOfficialDailyMcpConsentConfig,
  validOfficialDailyOAuthAuthorizationId,
} from '../../officialDailyMcpConsent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = {
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};
// Consent HTML needs a real Origin on native same-site form POSTs. Origin-only
// Referer prevents the authorization_id query from being sent in that header.
// Keep the stricter no-referrer policy on OAuth provider redirects and errors.
const CONSENT_HTML_HEADERS = { ...HEADERS, 'referrer-policy': 'origin' };
const escape = (text: string) => text.replace(/[&<>"']/g, char =>
  ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string> )[char] ?? char);
function page(body: string, status = 200) {
  return new NextResponse('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Authorize ChatGPT | Initial Baseball</title></head><body><main><h1>Authorize ChatGPT</h1>'
    + body + '</main></body></html>', {
    status, headers: { ...CONSENT_HTML_HEADERS, 'content-type': 'text/html; charset=utf-8' },
  });
}
function fail(status: number) {
  return creatorAuthResponse(NextResponse.json({ error: status === 404 ? 'not_found' : 'unavailable' },
    { status, headers: HEADERS }));
}
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = readOfficialDailyMcpConsentConfig();
  if (!config || request.nextUrl.origin !== config.creator.origin
      || request.headers.get('host') !== new URL(config.creator.origin).host) return fail(404);
  const params = request.nextUrl.searchParams;
  const authorizationId = params.get('authorization_id');
  if (params.size !== 1 || !validOfficialDailyOAuthAuthorizationId(authorizationId)) return fail(400);
  const auth = creatorAuthClient(request, config.creator);
  const session = await inspectCreatorAccountSession(auth.client);
  if (session.kind === 'unavailable') return auth.finish(fail(503));
  if (session.kind === 'guest') return auth.finish(page(
    '<p>Sign in to your Initial Baseball account in a separate tab, then refresh this page to review the request.</p>'
    + '<p><a href="/account" target="_blank" rel="noopener noreferrer">Open account sign-in</a></p>',
    401,
  ));
  if (session.id !== config.editorId) return auth.finish(fail(403));
  try {
    const { data, error } = await auth.client.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) return auth.finish(fail(503));
    const details = inspectOfficialDailyOAuthDetails(data, authorizationId, config);
    if (!details) return auth.finish(fail(403));
    if (details.kind === 'redirect') return auth.finish(NextResponse.redirect(details.url, { status: 303, headers: HEADERS }));
    return auth.finish(page(
      '<p>The application <strong>' + escape(details.clientName) + '</strong> requests access to the private Official Daily editor.</p>'
      + '<p>Approved callback: ' + escape(config.callback) + '</p>'
      + '<p>Identity scopes: ' + escape(details.scopes) + '</p>'
      + '<p>Scheduling a draft and issuing an immutable edition each require separate explicit confirmation.</p>'
      + '<form action="/api/official-daily/oauth/decision" method="post">'
      + '<input type="hidden" name="authorization_id" value="' + escape(authorizationId) + '">'
      + '<button name="decision" value="approve" type="submit">Authorize</button> '
      + '<button name="decision" value="deny" type="submit">Deny</button></form>',
    ));
  } catch { return auth.finish(fail(503)); }
}
