import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./serverCreatorAccountAuth', () => ({
  creatorAuthEnvironment: vi.fn(() => ({
    origin: 'https://qa.initial.test', supabaseUrl: 'https://supabase-qa.test', key: 'public-test',
  })),
}));
import { inspectOfficialDailyOAuthDetails, readOfficialDailyMcpConsentConfig,
  validOfficialDailyOAuthAuthorizationId, validOfficialDailyOAuthRedirect } from './officialDailyMcpConsent';

const authorizationId = '234a4ce7-9dd1-4c44-a456-3c5818fda331';
const user = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const clientId = 'a8b92bcf-c7d3-4be0-8d02-2e6a48fd1580';
const callback = 'https://chatgpt.com/connector_platform_oauth_redirect';
const config = { editorId: user, clientId, callback };
const details = {
  authorization_id: authorizationId, redirect_uri: callback,
  client: { id: clientId, name: 'ChatGPT' },
  user: { id: user }, scope: 'openid',
};
const env = {
  SUPABASE_URL: 'https://supabase-qa.test',
  OFFICIAL_DAILY_EDITOR_MCP_RESOURCE_URL: 'https://qa.initial.test/api/official-daily/mcp',
  OFFICIAL_DAILY_EDITOR_MCP_CLIENT_ID: clientId,
  OFFICIAL_DAILY_EDITOR_MCP_USER_ID: user,
  OFFICIAL_DAILY_EDITOR_MCP_CALLBACK_URL: callback,
  OFFICIAL_DAILY_EDITOR_MCP_CONSENT_ENABLED: 'true',
  OFFICIAL_DAILY_EDITOR_MCP_ENABLED: 'true',
  OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED: 'true',
};
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => vi.clearAllMocks());
describe('QA-only MCP OAuth consent authorization boundary', () => {
  it('is off until three exact switches and complete same-environment URL configuration', () => {
    expect(readOfficialDailyMcpConsentConfig({})).toBeNull();
    expect(readOfficialDailyMcpConsentConfig(env)).toMatchObject(config);
    for (const flag of ['OFFICIAL_DAILY_EDITOR_MCP_CONSENT_ENABLED',
      'OFFICIAL_DAILY_EDITOR_MCP_ENABLED', 'OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED']) {
      expect(readOfficialDailyMcpConsentConfig({ ...env, [flag]: 'false' })).toBeNull();
    }
    expect(readOfficialDailyMcpConsentConfig({
      ...env, OFFICIAL_DAILY_EDITOR_MCP_RESOURCE_URL: 'https://another.test/api/official-daily/mcp',
    })).toBeNull();
    expect(readOfficialDailyMcpConsentConfig({
      ...env, OFFICIAL_DAILY_EDITOR_MCP_CALLBACK_URL: 'http://chatgpt.com/callback',
    })).toBeNull();
    expect(readOfficialDailyMcpConsentConfig({
      ...env, OFFICIAL_DAILY_EDITOR_MCP_CALLBACK_URL: callback + '?open=1',
    })).toBeNull();
  });
  it('refuses invalid request IDs and forged client, editor, callback, scope or missing consent', () => {
    expect(validOfficialDailyOAuthAuthorizationId(authorizationId)).toBe(true);
    expect(validOfficialDailyOAuthAuthorizationId('bad')).toBe(false);
    expect(inspectOfficialDailyOAuthDetails(details, authorizationId, config)).toEqual({
      kind: 'consent', clientName: 'ChatGPT', scopes: 'openid',
    });
    for (const input of [
      { ...details, authorization_id: 'different-id-string' },
      { ...details, client: { id: 'attacker-client', name: 'ChatGPT' } },
      { ...details, user: { id: 'attacker-user' } },
      { ...details, redirect_uri: 'https://attacker.test/callback' },
      { ...details, scope: 'openid dangerous:write' },
      { ...details, scope: 'email' },
      { ...details, scope: 'openid openid' },
      { ...details, client: { id: clientId, name: '<script>' + 'x'.repeat(200) } },
    ]) expect(inspectOfficialDailyOAuthDetails(input, authorizationId, config)).toBeNull();
  });
  it('accepts only exact registered callback, one provider code/error and bounded state', () => {
    const callbackWithCode = callback + '?code=opaque-code&state=1234567890';
    expect(validOfficialDailyOAuthRedirect(callbackWithCode, callback)).toBe(true);
    expect(inspectOfficialDailyOAuthDetails({ redirect_url: callbackWithCode }, authorizationId, config))
      .toEqual({ kind: 'redirect', url: callbackWithCode });
    expect(validOfficialDailyOAuthRedirect(callback + '?error=access_denied&state=1234567890', callback)).toBe(true);
    for (const target of [
      'https://attacker.test/callback?code=one&state=1234567890',
      callback + '/wrong?code=one&state=1234567890',
      callback + '?code=one&error=denied&state=1234567890',
      callback + '?code=one&state=1234567890&state=another',
      callback + '?code=one&state=short',
      callback + '?code=one&state=1234567890&redirect=https://attacker.test',
      callback + '#code=one',
    ]) expect(validOfficialDailyOAuthRedirect(target, callback)).toBe(false);
  });
});
