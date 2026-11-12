import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const verifyOtp = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { verifyOtp, getUser } }) }));
import { POST } from './route';
const ORIGIN = 'https://game.example';
function request(body: string) {
  return new NextRequest(`${ORIGIN}/api/account/auth/verify`, {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body,
  });
}
beforeEach(() => {
  vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
  vi.stubEnv('CREATOR_AUTH_SITE_URL', ORIGIN);
  vi.stubEnv('SUPABASE_URL', 'https://qa.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  verifyOtp.mockReset(); getUser.mockReset();
});
describe('email code verification', () => {
  it('rejects malformed code and duplicate email without Auth calls', async () => {
    expect((await POST(request('email=a%40b.co&token=12345'))).headers.get('location')).toBe(`${ORIGIN}/account?status=invalid`);
    expect((await POST(request('email=a%40b.co&email=c%40b.co&token=123456'))).headers.get('location')).toBe(`${ORIGIN}/account?status=invalid`);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
  it('uses verified Auth identity after OTP exchange', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'uuid', email_confirmed_at: 'date' } }, error: null });
    const response = await POST(request('email=a%40b.co&token=123456'));
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email' });
    expect(response.headers.get('location')).toBe(`${ORIGIN}/account`);
  });
  it('fails closed if the OTP exchanges but Auth will not confirm the account', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'uuid' } }, error: null });
    expect((await POST(request('email=a%40b.co&token=123456'))).headers.get('location')).toBe(`${ORIGIN}/account?status=invalid`);
  });
});
