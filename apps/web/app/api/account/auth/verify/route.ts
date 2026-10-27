import { NextRequest, NextResponse } from 'next/server';
import { creatorAuthClient, creatorAuthConfiguration, creatorAuthForm, creatorAuthResponse, sameOriginPost, verifiedCreatorAccount } from '../../../../serverCreatorAccountAuth';

export async function POST(request: NextRequest) {
  const config = creatorAuthConfiguration(request);
  if (!config) return creatorAuthResponse(NextResponse.json({ error: 'not_found' }, { status: 404 }));
  if (!sameOriginPost(request)) return creatorAuthResponse(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
  const form = await creatorAuthForm(request);
  const email = form?.get('email');
  const token = form?.get('token');
  if (!form || [...form.keys()].some(key => key !== 'email' && key !== 'token')
    || typeof email !== 'string' || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return creatorAuthResponse(NextResponse.redirect(`${config.origin}/account?status=invalid`, 303));
  }
  const auth = creatorAuthClient(request, config);
  const { error } = await auth.client.auth.verifyOtp({ email, token, type: 'email' })
    .catch(() => ({ error: true }));
  const account = error ? null : await verifiedCreatorAccount(auth.client);
  return auth.finish(NextResponse.redirect(
    `${config.origin}/account${account ? '' : '?status=invalid'}`, 303,
  ));
}
