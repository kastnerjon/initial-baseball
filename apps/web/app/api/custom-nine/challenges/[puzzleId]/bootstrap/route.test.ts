import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../../serverCustomNineBootstrap', () => ({
  createServerCustomNineBootstrapService: vi.fn(),
}));

import { createServerCustomNineBootstrapService } from '../../../../../serverCustomNineBootstrap';
import { GET } from './route';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://example.test/api/custom-nine/challenges/' + ID + '/bootstrap';
const bootstrap = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  bootstrap.mockResolvedValue({
    puzzleId: ID, rulesetVersion: 'points-v4',
    atBats: Array.from({ length: 9 }, (_, i) => ({ pitchNumber: i + 1, initials: 'P' + (i + 1) })),
    progressionToken: 'signed-token',
    hintBundle: { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
  });
  vi.mocked(createServerCustomNineBootstrapService).mockReturnValue({ bootstrap });
});

function get(puzzleId: string = ID) {
  return GET(new Request(URL), { params: Promise.resolve({ puzzleId }) });
}

describe('Custom Nine signed bootstrap GET', () => {
  it('returns only server-projected opening session, private no-store, no answer fields', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const json = await response.json();
    expect(json).toMatchObject({ puzzleId: ID, rulesetVersion: 'points-v4', progressionToken: 'signed-token' });
    expect(json).not.toHaveProperty('canonicalPlayerIds');
    expect(json).not.toHaveProperty('issuedAt');
    expect(bootstrap).toHaveBeenCalledWith(ID);
  });

  it('maps both malformed and missing IDs to the same 404', async () => {
    bootstrap.mockResolvedValue(null);
    for (const id of ['not-a-uuid', ID]) {
      const response = await get(id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
  });

  it('sanitizes provider, data and signing configuration errors', async () => {
    bootstrap.mockRejectedValueOnce(new Error('private-name secret-hint SUPABASE_SERVICE_ROLE_KEY'));
    const response = await get();
    expect(response.status).toBe(503);
    const serialized = await response.text();
    expect(serialized).toBe('{"error":"session_unavailable"}');
    expect(serialized).not.toContain('secret');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
