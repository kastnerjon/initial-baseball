import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
vi.mock('../../../serverCreatorAccountAuth', () => ({
  creatorAuthConfiguration: vi.fn(() => ({ origin: 'https://example.test' })),
  creatorAuthClient: vi.fn(() => ({ client: {}, finish: (response: unknown) => response })),
  verifiedCreatorAccount: vi.fn(),
  creatorAuthResponse: (response: unknown) => response,
}));
vi.mock('../../../serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn(() => ({})) }));
vi.mock('../../../serverCreatorCreationsRead', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../serverCreatorCreationsRead')>();
  return { ...actual, listVerifiedCreatorCreations: vi.fn() };
});
import { GET } from './route';
import { creatorAuthConfiguration, verifiedCreatorAccount } from '../../../serverCreatorAccountAuth';
import { listVerifiedCreatorCreations } from '../../../serverCreatorCreationsRead';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';

const UUID = '123e4567-e89b-42d3-a456-426614174099';
const PUZZLE = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const CURSOR = '2026-10-26T20:00:00.123456+00:00|' + PUZZLE;
function request(query = '') {
  return new NextRequest('https://example.test/api/account/creations' + query);
}
beforeEach(() => {
  vi.mocked(creatorAuthConfiguration).mockReset();
  vi.mocked(creatorAuthConfiguration).mockReturnValue({
    origin: 'https://example.test', supabaseUrl: 'https://qa.supabase.co', key: 'publishable',
  });
  vi.mocked(verifiedCreatorAccount).mockReset();
  vi.mocked(verifiedCreatorAccount).mockResolvedValue({ id: UUID });
  vi.mocked(listVerifiedCreatorCreations).mockReset();
  vi.mocked(listVerifiedCreatorCreations).mockResolvedValue({ creations: [], nextCursor: null });
  vi.mocked(createServerSupabaseClient).mockClear();
});

describe('verified creator My Creations paginated API', () => {
  it('fails closed before DB access on disabled config or unsigned session', async () => {
    vi.mocked(creatorAuthConfiguration).mockReturnValueOnce(null);
    expect((await GET(request())).status).toBe(404);
    vi.mocked(verifiedCreatorAccount).mockResolvedValueOnce(null);
    const result = await GET(request());
    expect(result.status).toBe(401);
    expect(await result.json()).toEqual({ error: 'authentication_required' });
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('uses only the verified session UUID for the first private page', async () => {
    const page = { creations: [{
      puzzleId: PUZZLE, title: 'Mets Legends', issuedAt: '2026-10-26T20:00:00Z',
    }], nextCursor: CURSOR };
    vi.mocked(listVerifiedCreatorCreations).mockResolvedValueOnce(page);
    const result = await GET(request());
    expect(result.status).toBe(200);
    const payload = await result.json();
    expect(payload).toEqual({ ...page, accountScope: createHash('sha256')
      .update('initial-baseball:my-creations:v1:' + UUID).digest('hex') });
    expect(JSON.stringify(payload)).not.toContain(UUID);
    expect(listVerifiedCreatorCreations).toHaveBeenCalledWith(expect.anything(), UUID, null);
  });

  it('changes the presentation scope when another verified account pages the list', async () => {
    const a = await (await GET(request())).json() as { accountScope: string };
    const other = '123e4567-e89b-42d3-a456-426614174098';
    vi.mocked(verifiedCreatorAccount).mockResolvedValueOnce({ id: other });
    const b = await (await GET(request('?cursor=' + encodeURIComponent(CURSOR)))).json() as { accountScope: string };
    expect(a.accountScope).toMatch(/^[0-9a-f]{64}$/);
    expect(b.accountScope).not.toBe(a.accountScope);
    expect(listVerifiedCreatorCreations).toHaveBeenLastCalledWith(expect.anything(), other, CURSOR);
    expect(JSON.stringify(b)).not.toContain(other);
  });

  it('allows a bounded exact cursor without accepting account filters or duplicates', async () => {
    const response = await GET(request('?cursor=' + encodeURIComponent(CURSOR)));
    expect(response.status).toBe(200);
    expect(listVerifiedCreatorCreations).toHaveBeenCalledWith(expect.anything(), UUID, CURSOR);
    vi.mocked(listVerifiedCreatorCreations).mockClear();
    vi.mocked(createServerSupabaseClient).mockClear();
    for (const query of [
      '?accountId=other', '?cursor=', '?cursor=../../secret',
      '?cursor=' + encodeURIComponent(CURSOR) + '&accountId=other',
      '?cursor=' + encodeURIComponent(CURSOR) + '&cursor=' + encodeURIComponent(CURSOR),
    ]) {
      expect((await GET(request(query))).status).toBe(404);
    }
    expect(listVerifiedCreatorCreations).not.toHaveBeenCalled();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('sanitizes provider errors without leaking SQL, account IDs or clues', async () => {
    vi.mocked(listVerifiedCreatorCreations).mockRejectedValueOnce(new Error('private clue/SQL'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'creations_unavailable' });
  });
});
