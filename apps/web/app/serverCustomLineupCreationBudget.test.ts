import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn() }));

import { createServerSupabaseClient } from './serverSupabaseClient';
import {
  deriveCreationBudgetDigest,
  reservePublicCustomLineupCreation,
  verifiedVercelCreationIp,
} from './serverCustomLineupCreationBudget';

const ENV = {
  VERCEL: '1', VERCEL_ENV: 'preview',
  CUSTOM_LINEUP_CREATION_BUDGET_SECRET: 'private-test-secret-with-over-thirty-two-chars',
};
const REQUEST = new Request('https://game.example.test/api/custom-lineup/create', {
  headers: { 'x-forwarded-for': '203.0.113.17', 'x-vercel-forwarded-for': '203.0.113.17' },
});
const rpc = vi.fn();
const CLOCK = () => new Date('2026-10-18T18:00:00Z');
const DAY = '2026-10-18';
beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0, server_utc_day: DAY }], error: null });
  vi.mocked(createServerSupabaseClient).mockReturnValue({ rpc } as never);
});
afterEach(() => { vi.clearAllMocks(); });

describe('server-only public Custom creation budget', () => {
  it('only accepts one platform-overwritten valid IP in a Vercel deployment', () => {
    expect(verifiedVercelCreationIp(REQUEST, ENV)).toBe('203.0.113.17');
    expect(verifiedVercelCreationIp(REQUEST, { ...ENV, VERCEL: undefined })).toBeNull();
    expect(verifiedVercelCreationIp(REQUEST, { ...ENV, VERCEL_ENV: 'development' })).toBeNull();
    for (const ip of ['203.0.113.17, 10.0.0.1', '', '1.2.3.4:3000', 'bad-ip']) {
      expect(verifiedVercelCreationIp(new Request(REQUEST, {
        headers: { 'x-forwarded-for': ip },
      }), ENV)).toBeNull();
    }
    expect(verifiedVercelCreationIp(new Request(REQUEST, {
      headers: { 'x-forwarded-for': '203.0.113.17', 'x-vercel-forwarded-for': '8.8.8.8' },
    }), ENV)).toBeNull();
    expect(verifiedVercelCreationIp(new Request(REQUEST, {
      headers: { 'x-forwarded-for': '2001:db8::1' },
    }), ENV)).toBe('2001:db8::1');
  });

  it('produces a day-scoped keyed digest without exposing the IP or secret', () => {
    const first = deriveCreationBudgetDigest('203.0.113.17', '2026-10-18', ENV.CUSTOM_LINEUP_CREATION_BUDGET_SECRET);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('203.0.113.17');
    expect(first).not.toBe(deriveCreationBudgetDigest('203.0.113.18', '2026-10-18', ENV.CUSTOM_LINEUP_CREATION_BUDGET_SECRET));
    expect(first).not.toBe(deriveCreationBudgetDigest('203.0.113.17', '2026-10-19', ENV.CUSTOM_LINEUP_CREATION_BUDGET_SECRET));
    expect(first).toBe(deriveCreationBudgetDigest('203.0.113.17', '2026-10-18', ENV.CUSTOM_LINEUP_CREATION_BUDGET_SECRET));
  });

  it('sends only a digest to the private reservation RPC', async () => {
    expect(await reservePublicCustomLineupCreation(REQUEST, ENV, CLOCK))
      .toEqual({ allowed: true });
    expect(createServerSupabaseClient).toHaveBeenCalledWith(ENV);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('reserve_custom_lineup_creation_budget', {
      p_client_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_claimed_utc_day: DAY,
    });
  });

  it('keeps 429 retry semantics and refuses malformed provider responses', async () => {
    rpc.mockResolvedValueOnce({ data: [{ allowed: false, retry_after_seconds: 239, server_utc_day: DAY }], error: null });
    expect(await reservePublicCustomLineupCreation(REQUEST, ENV, CLOCK)).toEqual({
      allowed: false, retryAfterSeconds: 239,
    });
    for (const reply of [
      { data: [], error: null },
      { data: [{ allowed: true, retry_after_seconds: 1, server_utc_day: DAY }], error: null },
      { data: [{ allowed: false, retry_after_seconds: 0, server_utc_day: DAY }], error: null },
      { data: null, error: { message: 'private' } },
    ]) {
      rpc.mockResolvedValueOnce(reply);
      await expect(reservePublicCustomLineupCreation(REQUEST, ENV, CLOCK)).rejects.toThrow();
    }
  });

  it('reconciles a midnight clock mismatch using DB day without admitting twice', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ allowed: false, retry_after_seconds: 0, server_utc_day: '2026-10-19' }],
      error: null,
    }).mockResolvedValueOnce({
      data: [{ allowed: true, retry_after_seconds: 0, server_utc_day: '2026-10-19' }],
      error: null,
    });
    expect(await reservePublicCustomLineupCreation(REQUEST, ENV, CLOCK)).toEqual({ allowed: true });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]?.[1]?.p_claimed_utc_day).toBe(DAY);
    expect(rpc.mock.calls[1]?.[1]?.p_claimed_utc_day).toBe('2026-10-19');
    expect(rpc.mock.calls[1]?.[1]?.p_client_digest).not.toBe(rpc.mock.calls[0]?.[1]?.p_client_digest);
  });

  it('fails closed on repeated day changes or contradictory provider day', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ allowed: false, retry_after_seconds: 0, server_utc_day: '2026-10-19' }],
      error: null,
    }).mockResolvedValueOnce({
      data: [{ allowed: false, retry_after_seconds: 0, server_utc_day: '2026-10-20' }],
      error: null,
    });
    await expect(reservePublicCustomLineupCreation(REQUEST, ENV, CLOCK)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(2);

    rpc.mockReset().mockResolvedValueOnce({
      data: [{ allowed: true, retry_after_seconds: 0, server_utc_day: '2026-10-19' }],
      error: null,
    });
    await expect(reservePublicCustomLineupCreation(REQUEST, ENV, CLOCK)).rejects.toThrow();
  });

  it('fails closed without trusted provenance, secret or service provider', async () => {
    for (const env of [
      { ...ENV, VERCEL: '' },
      { ...ENV, CUSTOM_LINEUP_CREATION_BUDGET_SECRET: '' },
      { ...ENV, CUSTOM_LINEUP_CREATION_BUDGET_SECRET: 'short' },
    ]) {
      await expect(reservePublicCustomLineupCreation(REQUEST, env, CLOCK)).rejects.toThrow();
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
