import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const signInWithOAuth = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { signInWithOAuth, signInWithOtp } }) }));
import { POST } from './route';
const ORIGIN = 'https://game.example';
function request(body: string, origin = ORIGIN) {
  return new NextRequest(`${ORIGIN}/api/account/auth/start`, {
    method: 'POST', body, headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
  });
}
beforeEach(() => {
  vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
  vi.stubEnv('CREATOR_AUTH_SITE_URL', ORIGIN);
  vi.stubEnv('SUPABASE_URL', 'https://qa.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  signInWithOAuth.mockReset(); signInWithOtp.mockReset();
});
describe('auth start', () => {
  it('rejects foreign origin before provider I/O', async () => {
    expect((await POST(request('provider=google', 'https://evil.example'))).status).toBe(403);
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });
  it('uses a fixed callback and only redirects to the configured Supabase origin', async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: 'https://qa.supabase.co/auth/v1/authorize?provider=google' }, error: null });
    const response = await POST(request('provider=google'));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://qa.supabase.co/auth/v1/authorize?provider=google');
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${ORIGIN}/auth/callback` } });
    signInWithOAuth.mockResolvedValue({ data: { url: 'https://evil.example/auth/v1/authorize' }, error: null });
    expect((await POST(request('provider=google'))).headers.get('location')).toBe(`${ORIGIN}/account?status=unavailable`);
  });
  it('uses OTP without revealing whether the address exists or provider accepted it', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'rate limit' } });
    const response = await POST(request('provider=email&email=a%40b.co'));
    expect(response.headers.get('location')).toBe(`${ORIGIN}/account?status=sent`);
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.co', options: { shouldCreateUser: true } });
  });
  it('fails closed when auth is disabled', async () => {
    vi.stubEnv('CREATOR_AUTH_ENABLED', 'false');
    expect((await POST(request('provider=google'))).status).toBe(404);
  });
});
