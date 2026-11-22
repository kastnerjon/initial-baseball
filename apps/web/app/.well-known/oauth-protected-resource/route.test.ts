import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../officialDailyMcpAuthorization', () => ({
  readOfficialDailyMcpConfig: vi.fn(() => ({
    resource: 'https://qa.test/api/official-daily/mcp',
    authorizationServer: 'https://supabase-qa.test/auth/v1',
  })),
}));
import { GET } from './route';
afterEach(() => vi.unstubAllEnvs());
it('publishes only limited OAuth metadata while both explicit QA flags are enabled', async () => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_ENABLED', 'false');
  expect((await GET()).status).toBe(404);
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'false');
  expect((await GET()).status).toBe(404);
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    resource: 'https://qa.test/api/official-daily/mcp',
    authorization_servers: ['https://supabase-qa.test/auth/v1'],
    scopes_supported: ['openid'], bearer_methods_supported: ['header'],
  });
});
