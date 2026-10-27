import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
vi.mock('server-only', () => ({}));
vi.mock('./serverCreatorAccountAuth', () => ({
  creatorAuthConfiguration: vi.fn(() => ({
    origin: 'https://example.test', supabaseUrl: 'https://qa.supabase.co', key: 'publishable',
  })),
  creatorAuthClient: vi.fn(() => ({
    client: { auth: {} },
    finish: (r: NextResponse) => {
      r.cookies.set('sb-auth-session', 'renewed', { httpOnly: true, path: '/', sameSite: 'lax' });
      return r;
    },
  })),
  inspectCreatorAccountSession: vi.fn(),
}));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn() }));
const { ownerRead, markCreator } = vi.hoisted(() => ({
  ownerRead: vi.fn(), markCreator: vi.fn(),
}));
vi.mock('./supabaseCustomLineupV2IssuedReader', () => ({
  createSupabaseCustomLineupV2IssuedReader: vi.fn(() => ({ getCreatorAccountId: ownerRead })),
}));
vi.mock('./supabaseCustomLineupV2ReservationRepository', () => ({
  markCustomLineupV2CreatorSeen: markCreator,
}));
vi.mock('./dailyProgressionSecret', () => ({
  getDailyProgressionSecret: vi.fn(() => '0123456789a-private-strong-creator-exclusion-signing-key'),
}));
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { inspectCustomLineupV2AccountCreator } from './serverCustomLineupV2AccountCreatorExclusion';
import { creatorAuthConfiguration, inspectCreatorAccountSession } from './serverCreatorAccountAuth';
import { createServerSupabaseClient } from './serverSupabaseClient';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const ACCOUNT = '123e4567-e89b-42d3-a456-426614174099';
const SECRET = '0123456789a-private-strong-creator-exclusion-signing-key';
const URL = 'https://example.test/api/custom-lineup/challenges/' + ID + '/attempt/bootstrap';
const signed = createCustomLineupV2AttemptBrowserCredential(SECRET).issue(ID, URL);
const COOKIE = signed.setCookie.split(';')[0]!;
const WITH_AUTH = COOKIE + '; sb-qa-auth-token=opaque-session';
function request(cookie = WITH_AUTH): Request {
  return new Request(URL, { headers: { cookie, origin: 'https://example.test' } });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
  vi.mocked(createServerSupabaseClient).mockReturnValue({} as never);
  vi.mocked(inspectCreatorAccountSession).mockResolvedValue({ kind: 'verified', id: ACCOUNT });
  ownerRead.mockResolvedValue(ACCOUNT);
  markCreator.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('server-verified Custom owner eligibility guard', () => {
  it('leaves guest gameplay untouched with Auth disabled or no verified session', async () => {
    vi.stubEnv('CREATOR_AUTH_ENABLED', 'false');
    const guest = await inspectCustomLineupV2AccountCreator(request(), ID, WITH_AUTH);
    expect(guest.owner).toBe(false);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
    vi.mocked(inspectCreatorAccountSession).mockResolvedValueOnce({ kind: 'guest' });
    const anonymous = await inspectCustomLineupV2AccountCreator(request(), ID, WITH_AUTH);
    expect(anonymous.owner).toBe(false);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('does not mark a different account or a pre-account anonymous issuer', async () => {
    ownerRead.mockResolvedValueOnce('123e4567-e89b-42d3-a456-426614174098');
    expect((await inspectCustomLineupV2AccountCreator(request(), ID, WITH_AUTH)).owner).toBe(false);
    ownerRead.mockResolvedValueOnce(null);
    expect((await inspectCustomLineupV2AccountCreator(request(), ID, WITH_AUTH)).owner).toBe(false);
    expect(markCreator).not.toHaveBeenCalled();
  });

  it('shows owner preview on another device after lost issuance response, without reserving', async () => {
    const result = await inspectCustomLineupV2AccountCreator(request('sb-qa-auth-token=opaque-session'), ID, 'sb-qa-auth-token=opaque-session');
    expect(result.owner).toBe(true);
    expect(markCreator).not.toHaveBeenCalled();
  });

  it('marks a prior guest attempt permanently in private storage when its owner signs in', async () => {
    const result = await inspectCustomLineupV2AccountCreator(request(), ID, WITH_AUTH);
    expect(result.owner).toBe(true);
    expect(ownerRead).toHaveBeenCalledWith(ID);
    expect(markCreator).toHaveBeenCalledWith(expect.anything(), {
      challengeId: ID, browserKeyDigest: signed.browserKeyDigest,
    });
    const res = result.finish(Response.json({ attemptMode: 'creator_preview' }, {
      headers: { 'set-cookie': signed.setCookie, 'cache-control': 'private, no-store' },
    }));
    const cookies = res.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('sb-auth-session=renewed');
    expect(cookies).toContain('ib-custom-lineup-v2-attempt-');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('does not mark a tampered browser cookie and rejects owner lookup or marker failures', async () => {
    expect((await inspectCustomLineupV2AccountCreator(request('bad=token; sb-qa-auth-token=opaque-session'), ID, 'bad=token; sb-qa-auth-token=opaque-session')).owner)
      .toBe(true);
    expect(markCreator).not.toHaveBeenCalled();
    ownerRead.mockRejectedValueOnce(new Error('PRIVATE_SQL'));
    await expect(inspectCustomLineupV2AccountCreator(request(), ID, WITH_AUTH))
      .rejects.toThrow('Custom creator ownership lookup unavailable.');
    markCreator.mockRejectedValueOnce(new Error('PRIVATE_SQL'));
    await expect(inspectCustomLineupV2AccountCreator(request(), ID, WITH_AUTH))
      .rejects.toThrow('Custom creator eligibility marker unavailable.');
  });

  it('makes the cookie finisher available even when Auth verification rejects', async () => {
    vi.mocked(inspectCreatorAccountSession).mockResolvedValueOnce({ kind: 'unavailable' });
    let finisher: ((result: Response) => Response) | undefined;
    await expect(inspectCustomLineupV2AccountCreator(
      request(), ID, WITH_AUTH, finish => { finisher = finish; },
    )).rejects.toThrow('Custom creator account verification unavailable.');
    expect(finisher).toBeTypeOf('function');
    const result = finisher!(Response.json({ error: 'session_unavailable' }, { status: 503 }));
    expect(result.status).toBe(503);
    expect(result.headers.get('set-cookie')).toContain('sb-auth-session=renewed');
  });

  it('fails closed if a presented session cannot be verified during an Auth outage', async () => {
    vi.mocked(inspectCreatorAccountSession).mockResolvedValueOnce({ kind: 'unavailable' });
    await expect(inspectCustomLineupV2AccountCreator(request(), ID, WITH_AUTH))
      .rejects.toThrow('Custom creator account verification unavailable.');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    // A browser with no Auth cookie remains a guest even while Auth is unavailable.
    const guest = await inspectCustomLineupV2AccountCreator(request(COOKIE), ID, COOKIE);
    expect(guest.owner).toBe(false);
  });

  it('fails closed for an enabled-but-misconfigured Auth boundary', async () => {
    vi.mocked(creatorAuthConfiguration).mockReturnValueOnce(null);
    await expect(inspectCustomLineupV2AccountCreator(request(), ID, WITH_AUTH))
      .rejects.toThrow('Custom creator identity configuration unavailable.');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
