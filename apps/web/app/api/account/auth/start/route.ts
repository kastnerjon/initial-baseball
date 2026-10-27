import { NextRequest, NextResponse } from 'next/server';
import { creatorAuthClient, creatorAuthConfiguration, creatorAuthForm, creatorAuthResponse, sameOriginPost } from '../../../../serverCreatorAccountAuth';

export async function POST(request: NextRequest) {
  const config = creatorAuthConfiguration(request);
  if (!config) return creatorAuthResponse(NextResponse.json({ error: 'not_found' }, { status: 404 }));
  if (!sameOriginPost(request)) return creatorAuthResponse(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
  const form = await creatorAuthForm(request);
  if (!form || [...form.keys()].some(key => key !== 'provider' && key !== 'email')) {
    return creatorAuthResponse(NextResponse.redirect(`${config.origin}/account?status=invalid`, 303));
  }
  const provider = form.get('provider');
  const auth = creatorAuthClient(request, config);
  if (provider === 'google' || provider === 'apple') {
    const { data, error } = await auth.client.auth.signInWithOAuth({
      provider, options: { redirectTo: `${config.origin}/auth/callback` },
    }).catch(() => ({ data: { url: null }, error: true }));
    let redirect: URL | null = null;
    try { redirect = data.url ? new URL(data.url) : null; } catch { /* invalid provider URL */ }
    if (error || !redirect || redirect.origin !== config.supabaseUrl
      || redirect.pathname !== '/auth/v1/authorize') {
      return auth.finish(NextResponse.redirect(`${config.origin}/account?status=unavailable`, 303));
    }
    return auth.finish(NextResponse.redirect(redirect, 303));
  }
  const email = form.get('email');
  if (provider !== 'email' || typeof email !== 'string' || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return auth.finish(NextResponse.redirect(`${config.origin}/account?status=invalid`, 303));
  }
  // Supabase's email template must contain {{ .Token }} for the code UX.
  await auth.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }).catch(() => null);
  // Same response for an existing, new, rejected, or rate-limited address.
  return auth.finish(NextResponse.redirect(`${config.origin}/account?status=sent`, 303));
}
