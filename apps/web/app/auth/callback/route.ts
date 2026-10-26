import { NextRequest, NextResponse } from 'next/server';
import { creatorAuthClient, creatorAuthConfiguration, creatorAuthResponse, verifiedCreatorAccount } from '../../serverCreatorAccountAuth';

export async function GET(request: NextRequest) {
  const config = creatorAuthConfiguration(request);
  if (!config) return creatorAuthResponse(NextResponse.json({ error: 'not_found' }, { status: 404 }));
  const code = request.nextUrl.searchParams.get('code');
  if (!code || code.length > 2048 || request.nextUrl.searchParams.size !== 1) {
    return creatorAuthResponse(NextResponse.redirect(`${config.origin}/account?status=invalid`, 303));
  }
  const auth = creatorAuthClient(request, config);
  const { error } = await auth.client.auth.exchangeCodeForSession(code)
    .catch(() => ({ error: true }));
  const account = error ? null : await verifiedCreatorAccount(auth.client);
  return auth.finish(NextResponse.redirect(
    `${config.origin}/account${account ? '' : '?status=invalid'}`, 303,
  ));
}
