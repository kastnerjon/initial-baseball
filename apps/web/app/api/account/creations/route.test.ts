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
vi.mock('../../../serverCreatorCreationsRead', () => ({ listVerifiedCreatorCreations: vi.fn() }));
import { GET } from './route';
import { creatorAuthConfiguration, verifiedCreatorAccount } from '../../../serverCreatorAccountAuth';
import { listVerifiedCreatorCreations } from '../../../serverCreatorCreationsRead';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';

const UUID = '123e4567-e89b-42d3-a456-426614174099';
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
  vi.mocked(listVerifiedCreatorCreations).mockResolvedValue([]);
});

describe('verified creator My Creations API', () => {
  it('fails closed before DB access on disabled config or unsigned session', async () => {
    vi.mocked(creatorAuthConfiguration).mockReturnValueOnce(null);
    expect((await GET(request())).status).toBe(404);
    vi.mocked(verifiedCreatorAccount).mockResolvedValueOnce(null);
    const result = await GET(request());
    expect(result.status).toBe(401);
    expect(await result.json()).toEqual({ error: 'authentication_required' });
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('uses only the verified session UUID for a narrow, private read', async () => {
    const creations = [{
      puzzleId: 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000',
      title: 'Mets Legends', issuedAt: '2026-10-26T20:00:00Z',
    }];
    vi.mocked(listVerifiedCreatorCreations).mockResolvedValueOnce(creations);
    const result = await GET(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ creations });
    expect(listVerifiedCreatorCreations).toHaveBeenCalledWith(expect.anything(), UUID);
  });

  it('rejects query overrides and sanitizes provider errors', async () => {
    expect((await GET(request('?accountId=other'))).status).toBe(404);
    vi.mocked(listVerifiedCreatorCreations).mockRejectedValueOnce(new Error('private clue/SQL'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'creations_unavailable' });
  });
});
