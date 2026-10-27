import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));
const createServerClient = vi.hoisted(() => vi.fn());
vi.mock('@supabase/ssr', () => ({ createServerClient }));
import {
  creatorAuthClient, creatorAuthConfiguration, creatorAuthEnvironment, creatorAuthPageHostAllowed, creatorAuthForm, sameOriginPost,
  inspectCreatorAccountSession, verifiedCreatorAccount,
} from './serverCreatorAccountAuth';

const ORIGIN = 'https://game.example';
function req(path = '/api/account/session', init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`${ORIGIN}${path}`, init);
}

beforeEach(() => {
  vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
  vi.stubEnv('CREATOR_AUTH_SITE_URL', ORIGIN);
  vi.stubEnv('SUPABASE_URL', 'https://qa.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  createServerClient.mockReset();
});

describe('creator account boundary', () => {
  it('fails closed when disabled, misconfigured or reached through a different host', () => {
    expect(creatorAuthConfiguration(req())).not.toBeNull();
    vi.stubEnv('CREATOR_AUTH_ENABLED', 'false');
    expect(creatorAuthConfiguration(req())).toBeNull();
    vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
    expect(creatorAuthConfiguration(new NextRequest('https://evil.example/api/account/session'))).toBeNull();
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', '');
    expect(creatorAuthConfiguration(req())).toBeNull();
  });

  it('rejects malformed configured origins and backends before rendering account UI', () => {
    expect(creatorAuthEnvironment()?.origin).toBe(ORIGIN);
    vi.stubEnv('CREATOR_AUTH_SITE_URL', 'https://game.example/invalid-path');
    expect(creatorAuthEnvironment()).toBeNull();
    vi.stubEnv('CREATOR_AUTH_SITE_URL', ORIGIN);
    vi.stubEnv('SUPABASE_URL', 'http://qa.supabase.co');
    expect(creatorAuthEnvironment()).toBeNull();
    vi.stubEnv('SUPABASE_URL', 'https://qa.supabase.co');
    vi.stubEnv('CREATOR_AUTH_ENABLED', 'false');
    expect(creatorAuthEnvironment()).toBeNull();
  });

  it('does not render account sign-in forms for a wrong or missing request host', () => {
    const config = creatorAuthEnvironment()!;
    expect(creatorAuthPageHostAllowed(config, 'game.example')).toBe(true);
    expect(creatorAuthPageHostAllowed(config, 'preview.example')).toBe(false);
    expect(creatorAuthPageHostAllowed(config, 'game.example:8443')).toBe(false);
    expect(creatorAuthPageHostAllowed(config, null)).toBe(false);
  });

  it('rejects missing or foreign POST origin and unexpected query', () => {
    expect(sameOriginPost(req('/api/account/auth/start', { method: 'POST' }))).toBe(false);
    expect(sameOriginPost(req('/api/account/auth/start?next=https://evil.example', {
      method: 'POST', headers: { origin: ORIGIN },
    }))).toBe(false);
    expect(sameOriginPost(req('/api/account/auth/start', {
      method: 'POST', headers: { origin: ORIGIN },
    }))).toBe(true);
  });

  it('bounds form bytes, rejects duplicate keys and non-form content', async () => {
    const headers = { 'content-type': 'application/x-www-form-urlencoded' };
    expect((await creatorAuthForm(req('/', { method: 'POST', headers, body: 'provider=email&email=a%40b.co' })))?.get('email')).toBe('a@b.co');
    expect(await creatorAuthForm(req('/', { method: 'POST', headers, body: 'email=a&email=b' }))).toBeNull();
    expect(await creatorAuthForm(req('/', { method: 'POST', headers, body: `email=${'a'.repeat(1025)}` }))).toBeNull();
    expect(await creatorAuthForm(req('/', { method: 'POST', body: '{}' }))).toBeNull();
  });

  it('writes HttpOnly host-scoped cookies and no-store when the auth client refreshes', () => {
    createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([{ name: 'sb-auth', value: 'secret', options: { domain: '.example', sameSite: 'none' } }],
        { 'Cache-Control': 'private, no-store' });
      return { auth: {} };
    });
    const auth = creatorAuthClient(req(), creatorAuthConfiguration(req())!);
    const response = auth.finish(NextResponse.json({ ok: true }));
    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=lax');
    expect(cookie).not.toContain('Domain=');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('treats definitively rejected sessions as guests, not Auth outages', async () => {
    const client = { auth: { getUser: vi.fn() } } as any;
    client.auth.getUser.mockResolvedValueOnce({
      data: { user: null }, error: new AuthApiError('session expired', 401, 'session_not_found'),
    });
    expect(await inspectCreatorAccountSession(client)).toEqual({ kind: 'guest' });
    client.auth.getUser.mockResolvedValueOnce({
      data: { user: null }, error: new AuthSessionMissingError(),
    });
    expect(await inspectCreatorAccountSession(client)).toEqual({ kind: 'guest' });
    client.auth.getUser.mockResolvedValueOnce({
      data: { user: null }, error: new AuthApiError('refresh rejected', 400, 'refresh_token_not_found'),
    });
    expect(await inspectCreatorAccountSession(client)).toEqual({ kind: 'guest' });
    client.auth.getUser.mockResolvedValueOnce({
      data: { user: null }, error: new AuthApiError('invalid bearer token', 401, 'bad_jwt'),
    });
    expect(await inspectCreatorAccountSession(client)).toEqual({ kind: 'guest' });
    for (const error of [
      new AuthRetryableFetchError('network unavailable', 503),
      new AuthApiError('rate limited', 429, 'over_request_rate_limit'),
      new AuthApiError('unrecognized unauthorized response', 401, 'unrelated_api_error'),
      new AuthApiError('unexpected response', 400, 'invalid_credentials'),
    ]) {
      client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error });
      expect(await inspectCreatorAccountSession(client)).toEqual({ kind: 'unavailable' });
    }
  });

  it('accepts only server-verified, confirmed, nonanonymous Auth users', async () => {
    const client = { auth: { getUser: vi.fn() } } as any;
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'uuid', email_confirmed_at: '2026-10-26T00:00:00Z' } }, error: null });
    expect(await verifiedCreatorAccount(client)).toEqual({ id: 'uuid' });
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'uuid', is_anonymous: true, email_confirmed_at: 'date' } }, error: null });
    expect(await verifiedCreatorAccount(client)).toBeNull();
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'uuid' } }, error: null });
    expect(await verifiedCreatorAccount(client)).toBeNull();
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
    expect(await verifiedCreatorAccount(client)).toBeNull();
  });
});
