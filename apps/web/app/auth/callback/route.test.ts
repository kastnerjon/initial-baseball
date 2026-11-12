import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const exchangeCodeForSession = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { exchangeCodeForSession, getUser } }) }));
import { GET } from './route';
const ORIGIN = 'https://game.example';
function request(query: string) { return new NextRequest(`${ORIGIN}/auth/callback${query}`); }
beforeEach(() => {
  vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
  vi.stubEnv('CREATOR_AUTH_SITE_URL', ORIGIN);
  vi.stubEnv('SUPABASE_URL', 'https://qa.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  exchangeCodeForSession.mockReset(); getUser.mockReset();
});
describe('OAuth callback', () => {
  it('rejects missing and unrecognized callback query without exchange', async () => {
    expect((await GET(request('?code=abc&next=https://evil.example'))).headers.get('location')).toBe(`${ORIGIN}/account?status=invalid`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('exchanges the PKCE code then verifies user through Auth server', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'account-uuid', email_confirmed_at: 'date' } }, error: null });
    const response = await GET(request('?code=abc'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(getUser).toHaveBeenCalledOnce();
    expect(response.headers.get('location')).toBe(`${ORIGIN}/account`);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('fails closed when exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid' } });
    expect((await GET(request('?code=bad'))).headers.get('location')).toBe(`${ORIGIN}/account?status=invalid`);
    expect(getUser).not.toHaveBeenCalled();
  });
});
