import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../officialDailyMcpAuthorization', () => ({
  readOfficialDailyMcpConfig: vi.fn(),
  isOfficialDailyMcpRequestOrigin: vi.fn(),
  verifyOfficialDailyMcpBearer: vi.fn(),
  officialDailyMcpChallenge: vi.fn(() => 'Bearer resource_metadata="https://qa.test/.well-known/oauth-protected-resource"'),
}));
vi.mock('../../../officialDailyMcpTools', () => ({ createOfficialDailyMcpServer: vi.fn() }));
vi.mock('@modelcontextprotocol/server', () => ({
  createMcpHandler: vi.fn(() => ({
    fetch: vi.fn(async () => new Response(JSON.stringify({ jsonrpc: '2.0', result: {}, id: 1 }),
      { status: 200, headers: { 'content-type': 'application/json' } })),
  })),
}));
import { DELETE, GET, POST } from './route';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { isOfficialDailyMcpRequestOrigin, readOfficialDailyMcpConfig,
  verifyOfficialDailyMcpBearer } from '../../../officialDailyMcpAuthorization';

const resource = 'https://qa.test/api/official-daily/mcp';
const config = {
  resource, issuer: 'https://supabase-qa.test/auth/v1',
  authorizationServer: 'https://supabase-qa.test/auth/v1',
  clientId: 'test-qa-client', editorId: '907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
};
function request(extra: Record<string, string> = {}, url = resource) {
  return new Request(url, {
    method: 'POST', headers: { 'content-type': 'application/json', ...extra },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
  });
}
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.mocked(readOfficialDailyMcpConfig).mockReturnValue(config);
  vi.mocked(isOfficialDailyMcpRequestOrigin).mockReturnValue(true);
  vi.mocked(verifyOfficialDailyMcpBearer).mockResolvedValue({
    actorId: 'mcp:qa-editor', clientId: 'test-qa-client', expiresAt: 1890000000,
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('gated authenticated MCP ingress', () => {
  it('is 404 on all methods by default and never constructs a privileged handler', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_ENABLED', 'false');
    expect((await POST(request())).status).toBe(404);
    expect((await GET()).status).toBe(404);
    expect((await DELETE()).status).toBe(404);
    expect(createMcpHandler).not.toHaveBeenCalled();
    expect(verifyOfficialDailyMcpBearer).not.toHaveBeenCalled();
  });
  it('rejects missing config, untrusted origin, query and wrong content type', async () => {
    vi.mocked(readOfficialDailyMcpConfig).mockReturnValueOnce(null);
    expect((await POST(request())).status).toBe(503);
    vi.mocked(isOfficialDailyMcpRequestOrigin).mockReturnValueOnce(false);
    expect((await POST(request({ origin: 'https://evil.test' }))).status).toBe(403);
    expect((await POST(request({ 'content-type': 'text/plain' }))).status).toBe(415);
    expect(verifyOfficialDailyMcpBearer).not.toHaveBeenCalled();
    expect(createMcpHandler).not.toHaveBeenCalled();
  });
  it('returns OAuth discovery challenge without private payloads or service access', async () => {
    vi.mocked(verifyOfficialDailyMcpBearer).mockResolvedValueOnce(null);
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('oauth-protected-resource');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(createMcpHandler).not.toHaveBeenCalled();
  });
  it('invokes SDK only after authorized editor and avoids duplicating bearer into its auth context', async () => {
    const res = await POST(request({ authorization: 'Bearer synthetic-token' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(createMcpHandler).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(createMcpHandler).mock.calls)).not.toContain('synthetic-token');
  });
});
