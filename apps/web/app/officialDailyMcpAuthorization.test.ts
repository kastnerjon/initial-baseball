import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
vi.mock('server-only', () => ({}));
import { isOfficialDailyMcpRequestOrigin, officialDailyMcpChallenge,
  readOfficialDailyMcpConfig, verifyOfficialDailyMcpBearer } from './officialDailyMcpAuthorization';

const resource = 'https://qa.initial.test/api/official-daily/mcp';
const issuer = 'https://supabase-qa.test/auth/v1';
const user = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const client = 'chatgpt-oauth-client';
const config = {
  resource, issuer, authorizationServer: issuer, clientId: client, editorId: user,
};
const env = {
  OFFICIAL_DAILY_EDITOR_MCP_RESOURCE_URL: resource,
  OFFICIAL_DAILY_EDITOR_MCP_CLIENT_ID: client,
  OFFICIAL_DAILY_EDITOR_MCP_USER_ID: user,
  SUPABASE_URL: 'https://supabase-qa.test',
};
afterEach(() => vi.restoreAllMocks());
describe('official Daily MCP OAuth admission', () => {
  it('fails closed on absent or non-HTTPS or partial cross-environment configuration', () => {
    expect(readOfficialDailyMcpConfig({})).toBeNull();
    expect(readOfficialDailyMcpConfig(env)).toEqual(config);
    expect(readOfficialDailyMcpConfig({ ...env, SUPABASE_URL: 'http://supabase-qa.test' })).toBeNull();
    expect(readOfficialDailyMcpConfig({ ...env, OFFICIAL_DAILY_EDITOR_MCP_RESOURCE_URL: resource + '?secret=1' })).toBeNull();
    expect(readOfficialDailyMcpConfig({ ...env, OFFICIAL_DAILY_EDITOR_MCP_USER_ID: 'bad-id' })).toBeNull();
  });
  it('checks canonical endpoint, origin, Host and Fetch Metadata', () => {
    function request(url = resource, headers: Record<string, string> = {}) {
      return new Request(url, { method: 'POST', headers });
    }
    expect(isOfficialDailyMcpRequestOrigin(request(), config)).toBe(true);
    expect(isOfficialDailyMcpRequestOrigin(request(resource, { host: 'evil.test' }), config)).toBe(false);
    expect(isOfficialDailyMcpRequestOrigin(request(resource, { origin: 'https://evil.test' }), config)).toBe(false);
    expect(isOfficialDailyMcpRequestOrigin(request(resource, { 'sec-fetch-site': 'cross-site' }), config)).toBe(false);
    expect(isOfficialDailyMcpRequestOrigin(request(resource + '?q=roster'), config)).toBe(false);
    expect(isOfficialDailyMcpRequestOrigin(request('https://evil.test/api/official-daily/mcp'), config)).toBe(false);
    expect(officialDailyMcpChallenge(config)).toContain('https://qa.initial.test/.well-known/oauth-protected-resource');
  });
  it('validates real asymmetric JWT and exact OAuth scope of editor, audience, client and issuer', async () => {
    const pair = await generateKeyPair('RS256', { modulusLength: 2048 });
    const jwk = await exportJWK(pair.publicKey);
    const keys = () => createLocalJWKSet({ keys: [{ ...jwk, alg: 'RS256', kid: 'qa-key' }] });
    const issue = (claims: Record<string, string> = {}, jwtIssuer = issuer, aud = resource) =>
      new SignJWT({ role: 'authenticated', client_id: client,
        authentication_method: 'oauth_provider/authorization_code', ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'qa-key' })
        .setIssuer(jwtIssuer).setAudience(aud).setSubject(user).setIssuedAt().setExpirationTime('10m')
        .sign(pair.privateKey);
    const verifierKeys = keys as unknown as Parameters<typeof verifyOfficialDailyMcpBearer>[3];
    const accepted = await issue();
    expect(await verifyOfficialDailyMcpBearer('Bearer ' + accepted, config, undefined, verifierKeys))
      .toMatchObject({ actorId: 'mcp:' + user, clientId: client });
    expect(await verifyOfficialDailyMcpBearer(null, config, undefined, verifierKeys)).toBeNull();
    expect(await verifyOfficialDailyMcpBearer('Bearer invalid', config, undefined, verifierKeys)).toBeNull();
    for (const jwt of [
      await issue({ client_id: 'other-client' }),
      await issue({ role: 'service_role' }),
      await issue({ authentication_method: 'password' }),
      await issue({}, issuer, 'authenticated'),
      await issue({}, 'https://other.test/auth/v1'),
    ]) expect(await verifyOfficialDailyMcpBearer('Bearer ' + jwt, config, undefined, verifierKeys)).toBeNull();
    expect(await verifyOfficialDailyMcpBearer('Bearer ' + accepted, { ...config, editorId: '00000000-0000-4000-8000-000000000000' }, undefined, verifierKeys)).toBeNull();
  });
});
