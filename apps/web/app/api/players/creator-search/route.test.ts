import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../serverCanonicalData', () => ({
  getCanonicalSearchCandidates: vi.fn(),
}));
vi.mock('../../../canonicalDailyPlayerLookup', () => ({
  getCanonicalDailyPlayer: vi.fn(),
}));

import { getCanonicalSearchCandidates } from '../../../serverCanonicalData';
import { getCanonicalDailyPlayer } from '../../../canonicalDailyPlayerLookup';
import { GET } from './route';

const CANDIDATES: ReturnType<typeof getCanonicalSearchCandidates> = [
  {
    id: 'ibp_00000000000000000001', displayName: 'Alex Current',
    aliases: [], playerType: 'hitter', primaryPosition: 'SS',
    firstYear: 2000, lastYear: 2010, teamsDisplay: 'NYM',
  },
  {
    id: 'ibp_00000000000000000002', displayName: 'Alex Missing',
    aliases: [], playerType: 'hitter', primaryPosition: 'SS',
    firstYear: 2000, lastYear: 2010, teamsDisplay: 'NYM',
  },
];

function search(q: string) {
  return GET(new Request('https://example.test/api/players/creator-search?q='
    + encodeURIComponent(q)));
}

beforeEach(() => {
  vi.stubEnv('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED', 'true');
  vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', 'true');
  vi.clearAllMocks();
  vi.mocked(getCanonicalSearchCandidates).mockReturnValue(CANDIDATES);
  vi.mocked(getCanonicalDailyPlayer).mockImplementation(id =>
    id === CANDIDATES[0]?.id ? {} as never : null);
});

afterEach(() => { vi.unstubAllEnvs(); });

describe('isolated Custom creator autocomplete', () => {
  it('remains 404 without either public creation or gameplay flag', async () => {
    vi.stubEnv('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED', '');
    expect(search('alex').status).toBe(404);
    vi.stubEnv('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED', 'true');
    vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', '');
    const response = search('alex');
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ results: [] });
    expect(getCanonicalSearchCandidates).not.toHaveBeenCalled();
    expect(getCanonicalDailyPlayer).not.toHaveBeenCalled();
  });

  it('refuses invalid queries before loading the player universe', async () => {
    for (const q of ['', ' ', 'x'.repeat(101)]) {
      expect(await search(q).json()).toEqual({ results: [] });
    }
    expect(getCanonicalSearchCandidates).not.toHaveBeenCalled();
    expect(getCanonicalDailyPlayer).not.toHaveBeenCalled();
  });

  it('offers only players resolvable by the same canonical issuer lookup', async () => {
    const response = search('alex');
    expect(response.status).toBe(200);
    const payload = await response.json() as { results: Array<{ playerId: string }> };
    expect(payload.results.map(p => p.playerId)).toEqual([CANDIDATES[0]?.id]);
    expect(getCanonicalDailyPlayer).toHaveBeenCalledWith(CANDIDATES[0]?.id);
    expect(getCanonicalDailyPlayer).toHaveBeenCalledWith(CANDIDATES[1]?.id);
    expect(JSON.stringify(payload)).not.toContain('Alex Missing');
    expect(getCanonicalSearchCandidates).toHaveBeenCalledOnce();

    const second = search('current');
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ results: [{ playerId: CANDIDATES[0]?.id }] });
    expect(getCanonicalSearchCandidates).toHaveBeenCalledOnce();
  });
});
