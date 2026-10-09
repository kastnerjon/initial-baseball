import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../serverCustomNinePublicRead', () => ({
  createServerCustomNinePublicReadService: vi.fn(),
}));

import { createServerCustomNinePublicReadService } from '../../../../serverCustomNinePublicRead';
import { GET } from './route';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://example.test/api/custom-nine/challenges/' + ID;
const read = vi.fn();
const publicChallenge = {
  puzzleId: ID, rulesetVersion: 'points-v4',
  atBats: Array.from({ length: 9 }, (_, i) => ({ pitchNumber: i + 1, initials: 'P' + (i + 1) })),
};

beforeEach(() => {
  read.mockReset();
  read.mockResolvedValue(publicChallenge);
  vi.mocked(createServerCustomNinePublicReadService).mockReturnValue({ read });
});

function get(puzzleId: string = ID) {
  return GET(new Request(URL), { params: Promise.resolve({ puzzleId }) });
}

describe('Custom Nine public metadata GET', () => {
  it('returns only redacted challenge metadata and private no-store headers', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(publicChallenge);
    expect(read).toHaveBeenCalledWith(ID);
  });

  it('returns the same opaque 404 for invalid and missing challenge IDs', async () => {
    for (const id of ['not-an-id', ID]) {
      read.mockResolvedValueOnce(null);
      const response = await get(id);
      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toEqual({ error: 'not_found' });
    }
  });

  it('maps store exceptions and malformed route parameters to sanitized 503', async () => {
    read.mockRejectedValueOnce(new Error('private-canonical-ID future-hint DB secret'));
    const response = await get();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const json = JSON.stringify(await response.json());
    expect(json).toBe('{"error":"challenge_unavailable"}');
    expect(json).not.toContain('private-canonical-ID');
  });

  it('never invokes the private reader for a request to the creation collection', async () => {
    expect(GET).toBeDefined();
    expect(read).not.toHaveBeenCalled();
  });
});
