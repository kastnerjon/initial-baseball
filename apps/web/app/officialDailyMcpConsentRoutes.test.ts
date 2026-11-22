import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const getUser = vi.hoisted(() => vi.fn());
const getAuthorizationDetails = vi.hoisted(() => vi.fn());
const approveAuthorization = vi.hoisted(() => vi.fn());
const denyAuthorization = vi.hoisted(() => vi.fn());
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser, oauth: { getAuthorizationDetails, approveAuthorization, denyAuthorization } },
  }),
}));
import { GET } from './oauth/consent/route';
import { POST } from './api/official-daily/oauth/decision/route';

const origin = 'https://qa.initial.test';
const editorId = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const clientId = 'a8b92bcf-c7d3-4be0-8d02-2e6a48fd1580';
const authorizationId = '234a4ce7-9dd1-4c44-a456-3c5818fda331';
const callback = 'https://chatgpt.com/connector_platform_oauth_redirect';
const returnUrl = callback + '?code=synthetic&state=abcdefgh12345678';
const details = {
  authorization_id: authorizationId, redirect_uri: callback,
  client: { id: clientId, name: '<Fake App>' },
  user: { id: editorId, email: 'editor@example.test' }, scope: 'openid',
};
function get(path = '/oauth/consent?authorization_id=' + authorizationId) {
  return new NextRequest(origin + path, { headers: { host: 'qa.initial.test' } });
}
function post(body = 'authorization_id=' + authorizationId + '&decision=approve', headers: Record<string, string> = {}) {
  return new NextRequest(origin + '/api/official-daily/oauth/decision', {
    method: 'POST', body, headers: { host: 'qa.initial.test', origin, 'content-type': 'application/x-www-form-urlencoded', ...headers },
  });
}
beforeEach(() => {
  vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
  vi.stubEnv('CREATOR_AUTH_SITE_URL', origin);
  vi.stubEnv('SUPABASE_URL', 'https://supabase-qa.test');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_RESOURCE_URL', origin + '/api/official-daily/mcp');
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_CLIENT_ID', clientId);
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_USER_ID', editorId);
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_CALLBACK_URL', callback);
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_CONSENT_ENABLED', 'true');
  getUser.mockReset();
  getAuthorizationDetails.mockReset();
  approveAuthorization.mockReset();
  denyAuthorization.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: editorId, email_confirmed_at: 'date' } }, error: null });
  getAuthorizationDetails.mockResolvedValue({ data: details, error: null });
  approveAuthorization.mockResolvedValue({ data: { redirect_url: returnUrl }, error: null });
  denyAuthorization.mockResolvedValue({ data: { redirect_url: callback + '?error=access_denied&state=abcdefgh12345678' }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('OAuth consent request/decision routes', () => {
  it('fails closed with flags off and never accesses Supabase Auth', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_MCP_CONSENT_ENABLED', 'false');
    expect((await GET(get())).status).toBe(404);
    expect((await POST(post())).status).toBe(404);
    expect(getUser).not.toHaveBeenCalled();
  });
  it('fails on missing/extra authorization query and disallows anonymous consent details', async () => {
    expect((await GET(get('/oauth/consent?authorization_id=short'))).status).toBe(400);
    expect((await GET(get('/oauth/consent?authorization_id=' + authorizationId + '&extra=1'))).status).toBe(400);
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await GET(get());
    expect(res.status).toBe(401);
    expect(await res.text()).toContain('separate tab');
    expect(getAuthorizationDetails).not.toHaveBeenCalled();
  });
  it('renders HTML-escaped client details with CSP and never leaks unverified scope', async () => {
    const res = await GET(get());
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain('&lt;Fake App&gt;');
    expect(body).not.toContain('<Fake App>');
    expect(body).toContain('type="submit"');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('refuses another client or editor before displaying consent or calling approve', async () => {
    getAuthorizationDetails.mockResolvedValueOnce({
      data: { ...details, client: { id: 'wrong-client', name: 'ChatGPT' } }, error: null,
    });
    expect((await GET(get())).status).toBe(403);
    getAuthorizationDetails.mockResolvedValueOnce({
      data: { ...details, client: { id: 'wrong-client', name: 'ChatGPT' } }, error: null,
    });
    expect((await POST(post())).status).toBe(403);
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'wrong-user', email_confirmed_at: 'date' } }, error: null,
    });
    expect((await POST(post())).status).toBe(403);
    expect(approveAuthorization).not.toHaveBeenCalled();
  });
  it('rejects cross-origin POST, duplicate fields, invalid choices and missing origin before provider I/O', async () => {
    expect((await POST(post(undefined, { origin: 'https://evil.test' }))).status).toBe(403);
    expect((await POST(post('authorization_id=' + authorizationId + '&decision=approve&decision=deny'))).status).toBe(400);
    expect((await POST(post('authorization_id=' + authorizationId + '&decision=publish'))).status).toBe(400);
    expect((await POST(post(undefined, { origin: '' }))).status).toBe(403);
    expect(approveAuthorization).not.toHaveBeenCalled();
  });
  it('re-checks exact verified authorization before approval and pins the provider redirect', async () => {
    const r = await POST(post());
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(returnUrl);
    expect(approveAuthorization).toHaveBeenCalledTimes(1);
    expect(approveAuthorization).toHaveBeenCalledWith(authorizationId);
    approveAuthorization.mockResolvedValue({ data: { redirect_url: 'https://attacker.test/?code=one' }, error: null });
    expect((await POST(post())).status).toBe(503);
  });
  it('supports explicit deny without approving and safely handles prior valid provider consent', async () => {
    const denied = await POST(post('authorization_id=' + authorizationId + '&decision=deny'));
    expect(denied.status).toBe(303);
    expect(denied.headers.get('location')).toContain('error=access_denied');
    expect(approveAuthorization).not.toHaveBeenCalled();
    getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: returnUrl }, error: null });
    expect((await GET(get())).headers.get('location')).toBe(returnUrl);
  });
});
