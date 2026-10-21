import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@initial-baseball/engine', () => ({
  searchCanonicalPlayers: vi.fn(),
}));
vi.mock('../../../serverCanonicalData', () => ({
  getCanonicalSearchCandidates: vi.fn(),
}));
vi.mock('../../../canonicalDailyPlayerLookup', () => ({
  getCanonicalDailyPlayer: vi.fn(),
}));

import { searchCanonicalPlayers } from '@initial-baseball/engine';
import { getCanonicalSearchCandidates } from '../../../serverCanonicalData';
import { getCanonicalDailyPlayer } from '../../../canonicalDailyPlayerLookup';
import { GET } from './route';

function search(query: string): ReturnType<typeof GET> {
  return GET(new Request('https://example.test/api/players/search?q=' + encodeURIComponent(query)));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCanonicalSearchCandidates).mockReturnValue([]);
  vi.mocked(searchCanonicalPlayers).mockReturnValue([]);
  vi.mocked(getCanonicalDailyPlayer).mockReturnValue(null);
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


  it('filters creator suggestions to players found by the immutable clue issuer resolver', async () => {
    const all = [
      { id: 'playable', displayName: 'Playable Player', aliases: [], playerType: 'hitter', primaryPosition: 'SS', firstYear: 2000, lastYear: 2020, teamsDisplay: 'NYM' },
      { id: 'unplayable', displayName: 'Unplayable Player', aliases: [], playerType: 'hitter', primaryPosition: 'SS', firstYear: 2000, lastYear: 2020, teamsDisplay: 'NYM' },
    ] as ReturnType<typeof getCanonicalSearchCandidates>;
    vi.mocked(getCanonicalSearchCandidates).mockReturnValue(all);
    vi.mocked(getCanonicalDailyPlayer).mockImplementation(id => id === 'playable' ? {} as never : null);

    const creator = GET(new Request('https://example.test/api/players/search?q=Player&scope=custom-creator'));
    expect(creator.status).toBe(200);
    expect(searchCanonicalPlayers).toHaveBeenLastCalledWith('Player', [all[0]]);
    expect(getCanonicalDailyPlayer).toHaveBeenCalledWith('playable');
    expect(getCanonicalDailyPlayer).toHaveBeenCalledWith('unplayable');

    const ordinary = search('Player');
    expect(ordinary.status).toBe(200);
    expect(searchCanonicalPlayers).toHaveBeenLastCalledWith('Player', all);
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
