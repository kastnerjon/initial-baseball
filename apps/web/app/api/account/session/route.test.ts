import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const getUser = vi.hoisted(() => vi.fn());
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser } }) }));
import { GET } from './route';
beforeEach(() => {
  vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
  vi.stubEnv('CREATOR_AUTH_SITE_URL', 'https://game.example');
  vi.stubEnv('SUPABASE_URL', 'https://qa.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  getUser.mockReset();
});
it('returns only the stable verified account ID, never metadata or credentials', async () => {
  getUser.mockResolvedValue({ data: { user: { id: 'uuid', email: 'private@example.com', user_metadata: { admin: true }, email_confirmed_at: 'date' } }, error: null });
  const response = await GET(new NextRequest('https://game.example/api/account/session'));
  expect(await response.json()).toEqual({ accountId: 'uuid' });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('returns no account for a revoked or expired session', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
  const response = await GET(new NextRequest('https://game.example/api/account/session'));
  expect(await response.json()).toEqual({ accountId: null });
});
