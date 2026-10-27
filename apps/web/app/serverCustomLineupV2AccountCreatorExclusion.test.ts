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
  verifiedCreatorAccount: vi.fn(),
}));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock('./dailyProgressionSecret', () => ({
  getDailyProgressionSecret: vi.fn(() => '0123456789a-private-strong-creator-exclusion-signing-key'),
}));
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { inspectCustomLineupV2AccountCreator } from './serverCustomLineupV2AccountCreatorExclusion';
import { creatorAuthConfiguration, verifiedCreatorAccount } from './serverCreatorAccountAuth';
import { createServerSupabaseClient } from './serverSupabaseClient';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const ACCOUNT = '123e4567-e89b-42d3-a456-426614174099';
const SECRET = '0123456789a-private-strong-creator-exclusion-signing-key';
const URL = 'https://example.test/api/custom-lineup/challenges/' + ID + '/attempt/bootstrap';
const signed = createCustomLineupV2AttemptBrowserCredential(SECRET).issue(ID, URL);
const COOKIE = signed.setCookie.split(';')[0]!;
const ownerRead = vi.fn();
const markRead = vi.fn();
const select = vi.fn(() => ({ eq: vi.fn().mockReturnThis(), maybeSingle: ownerRead }));
const markSelect = vi.fn(() => ({ maybeSingle: markRead }));
const update = vi.fn(() => ({ eq: vi.fn().mockReturnThis(), select: markSelect }));
const from = vi.fn((table: string) => table === 'custom_nine_issued_challenges'
  ? { select } : { update });

function request(cookie = COOKIE): Request {
  return new Request(URL, { headers: { cookie, origin: 'https://example.test' } });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
  vi.mocked(createServerSupabaseClient).mockReturnValue({ from } as never);
  vi.mocked(verifiedCreatorAccount).mockResolvedValue({ id: ACCOUNT });
  ownerRead.mockResolvedValue({ error: null, data: { creator_account_id: ACCOUNT } });
  markRead.mockResolvedValue({ error: null, data: { creator_seen: true } });
});
afterEach(() => vi.unstubAllEnvs());

describe('server-verified Custom owner eligibility guard', () => {
  it('leaves guest gameplay untouched with Auth disabled or no verified session', async () => {
    vi.stubEnv('CREATOR_AUTH_ENABLED', 'false');
    const guest = await inspectCustomLineupV2AccountCreator(request(), ID, COOKIE);
    expect(guest.owner).toBe(false);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    vi.stubEnv('CREATOR_AUTH_ENABLED', 'true');
    vi.mocked(verifiedCreatorAccount).mockResolvedValueOnce(null);
    const anonymous = await inspectCustomLineupV2AccountCreator(request(), ID, COOKIE);
    expect(anonymous.owner).toBe(false);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('does not mark a different account or a pre-account anonymous issuer', async () => {
    ownerRead.mockResolvedValueOnce({ error: null, data: { creator_account_id:
      '123e4567-e89b-42d3-a456-426614174098' } });
    expect((await inspectCustomLineupV2AccountCreator(request(), ID, COOKIE)).owner).toBe(false);
    ownerRead.mockResolvedValueOnce({ error: null, data: { creator_account_id: null } });
    expect((await inspectCustomLineupV2AccountCreator(request(), ID, COOKIE)).owner).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('shows owner preview on another device after lost issuance response, without reserving', async () => {
    const result = await inspectCustomLineupV2AccountCreator(request(''), ID, '');
    expect(result.owner).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('marks a prior guest attempt permanently in private storage when its owner signs in', async () => {
    const result = await inspectCustomLineupV2AccountCreator(request(), ID, COOKIE);
    expect(result.owner).toBe(true);
    expect(select).toHaveBeenCalledWith('creator_account_id');
    expect(update).toHaveBeenCalledWith({ creator_seen: true });
    const res = result.finish(Response.json({ attemptMode: 'creator_preview' }, {
      headers: { 'set-cookie': signed.setCookie, 'cache-control': 'private, no-store' },
    }));
    const cookies = res.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('sb-auth-session=renewed');
    expect(cookies).toContain('ib-custom-lineup-v2-attempt-');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('does not mark a tampered browser cookie and rejects owner lookup or marker failures', async () => {
    expect((await inspectCustomLineupV2AccountCreator(request('bad=token'), ID, 'bad=token')).owner)
      .toBe(true);
    expect(update).not.toHaveBeenCalled();
    ownerRead.mockResolvedValueOnce({ data: null, error: { message: 'PRIVATE_SQL' } });
    await expect(inspectCustomLineupV2AccountCreator(request(), ID, COOKIE))
      .rejects.toThrow('Custom creator ownership lookup unavailable.');
    markRead.mockResolvedValueOnce({ data: null, error: { message: 'PRIVATE_SQL' } });
    await expect(inspectCustomLineupV2AccountCreator(request(), ID, COOKIE))
      .rejects.toThrow('Custom creator eligibility marker unavailable.');
  });

  it('fails closed for an enabled-but-misconfigured Auth boundary', async () => {
    vi.mocked(creatorAuthConfiguration).mockReturnValueOnce(null);
    await expect(inspectCustomLineupV2AccountCreator(request(), ID, COOKIE))
      .rejects.toThrow('Custom creator identity configuration unavailable.');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
