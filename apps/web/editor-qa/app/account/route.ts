import { NextRequest, NextResponse } from 'next/server';
import { readOfficialDailyMcpConsentConfig } from '../../../app/officialDailyMcpConsent';
import { creatorAuthClient, creatorAuthForm, inspectCreatorAccountSession, sameOriginPost } from '../../../app/serverCreatorAccountAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = {
  'cache-control': 'private, no-store', 'referrer-policy': 'origin',
  'content-security-policy': "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
};

function configFor(request: NextRequest) {
  const config = readOfficialDailyMcpConsentConfig();
  return config && request.nextUrl.origin === config.creator.origin
    && request.headers.get('host') === new URL(config.creator.origin).host
    && !request.nextUrl.search ? config : null;
}
const fail = (status: number) => new NextResponse(null, { status, headers });
function page(body: string) {
  return new NextResponse('<!doctype html><html lang="en"><meta charset="utf-8"><title>Editor sign-in</title><main><h1>Editor sign-in</h1>'
    + body + '</main></html>', { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
}

export async function GET(request: NextRequest) {
  const config = configFor(request);
  if (!config) return fail(404);
  const auth = creatorAuthClient(request, config.creator);
  const session = await inspectCreatorAccountSession(auth.client);
  if (session.kind === 'unavailable') return fail(503);
  if (session.kind === 'verified') {
    if (session.id !== config.editorId) return fail(403);
    return auth.finish(page('<p>Signed in. Return to the authorization tab and refresh it.</p>'));
  }
  return auth.finish(page('<form method="post" action="/account"><label>Email <input type="email" name="email" autocomplete="username" required></label>'
    + '<label>Password <input type="password" name="password" autocomplete="current-password" required></label>'
    + '<button>Sign in</button></form>'));
}

export async function POST(request: NextRequest) {
  const config = configFor(request);
  if (!config) return fail(404);
  if (!sameOriginPost(request)) return fail(403);
  const form = await creatorAuthForm(request);
  const email = form?.get('email');
  const password = form?.get('password');
  if (form?.size !== 2 || !email || email.length > 254 || !password) return fail(400);
  const auth = creatorAuthClient(request, config.creator);
  try {
    const { error } = await auth.client.auth.signInWithPassword({ email, password });
    if (error) return fail(403);
    const session = await inspectCreatorAccountSession(auth.client);
    if (session.kind !== 'verified' || session.id !== config.editorId) return fail(403);
    return auth.finish(NextResponse.redirect(config.creator.origin + '/account', { status: 303, headers }));
  } catch { return fail(503); }
}
