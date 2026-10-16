import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@initial-baseball/engine', () => ({
  searchCanonicalPlayers: vi.fn(),
}));
vi.mock('../../../serverCanonicalData', () => ({
  getCanonicalSearchCandidates: vi.fn(),
}));

import { searchCanonicalPlayers } from '@initial-baseball/engine';
import { getCanonicalSearchCandidates } from '../../../serverCanonicalData';
import { GET } from './route';

function search(query: string): ReturnType<typeof GET> {
  return GET(new Request('https://example.test/api/players/search?q=' + encodeURIComponent(query)));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCanonicalSearchCandidates).mockReturnValue([]);
  vi.mocked(searchCanonicalPlayers).mockReturnValue([]);
});

describe('public canonical player search request bound', () => {
  it.each(['', ' ', '   \t  '])('short-circuits empty query %j before canonical data lookup', async query => {
    const result = search(query);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ results: [] });
    expect(getCanonicalSearchCandidates).not.toHaveBeenCalled();
    expect(searchCanonicalPlayers).not.toHaveBeenCalled();
  });

  it('accepts and trims ordinary player names without changing the existing result shape', async () => {
    const result = search('  Aaron Judge  ');
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ results: [] });
    expect(getCanonicalSearchCandidates).toHaveBeenCalledOnce();
    expect(searchCanonicalPlayers).toHaveBeenCalledWith('Aaron Judge', []);
  });

  it('allows the existing 100-character client ceiling', async () => {
    const query = 'a'.repeat(100);
    const result = search(query);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ results: [] });
    expect(getCanonicalSearchCandidates).toHaveBeenCalledOnce();
    expect(searchCanonicalPlayers).toHaveBeenCalledWith(query, []);
  });

  it.each([101, 4096])('rejects %i-character inputs before canonical lookup', async length => {
    const result = search('x'.repeat(length));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ results: [] });
    expect(getCanonicalSearchCandidates).not.toHaveBeenCalled();
    expect(searchCanonicalPlayers).not.toHaveBeenCalled();
  });

  it('does not reject a 100-character query merely for surrounding whitespace', async () => {
    const query = 'x'.repeat(100);
    const result = search('  ' + query + '  ');
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ results: [] });
    expect(searchCanonicalPlayers).toHaveBeenCalledWith(query, []);
  });
});
