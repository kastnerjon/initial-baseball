import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../dailyAdminComposition', () => ({ createDailyAdminContext: vi.fn(() => ({ repository: {} })) }));
vi.mock('../../../dailyAdminWorkflow', () => ({ createDailyAdminWorkflow: vi.fn() }));
import { createDailyAdminContext } from '../../../dailyAdminComposition';
import { createDailyAdminWorkflow } from '../../../dailyAdminWorkflow';
import { POST } from './route';
import { searchCanonicalPlayers } from '@initial-baseball/engine';

const AUTH = 'Basic ' + Buffer.from('editor:a-development-only-admin-password').toString('base64');
const searchPlayers = vi.fn(() => Array.from({ length: 30 }, (_, i) => ({
  canonicalPlayerId: `p${i}`, displayName: 'Player', yearsPlayedDisplay: '2000–2010',
  requiresYearDisambiguation: false, playerType: 'Batter', primaryPosition: 'CF',
  teamsDisplay: 'ABC', recognizabilityRank: i, revealReady: true, secret: 'DO_NOT_RETURN',
})));
const getHorizon = vi.fn(async () => [{ puzzleDate: '2030-01-01', selections: [{ slot: 1 }] }]);
const previewPlayer = vi.fn(() => ({ canonicalPlayerId: 'p1', displayName: 'Player', initials: 'PL',
  hints: [{ hintLabel: 'Hint', hintValue: 'Allowed', other: 'DO_NOT_RETURN' }],
  reveal: { playerType: 'Batter', seasons: [], secret: 'DO_NOT_RETURN', career: {
    firstSeason: 2000, lastSeason: 2010, primaryPosition: 'CF', teamIds: ['ABC'],
    batting: null, pitching: null, advanced: null,
  } },
}));
function request(body = 'q=Player', options: { url?: string; auth?: string; site?: string } = {}) {
  return new Request(options.url ?? 'https://example.test/admin/daily/players', { method: 'POST',
    headers: { authorization: options.auth ?? AUTH, origin: 'https://example.test',
      'sec-fetch-site': options.site ?? 'same-origin', 'content-type': 'application/x-www-form-urlencoded' }, body });
}
beforeEach(() => {
  vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor'); vi.stubEnv('DAILY_ADMIN_PASSWORD', 'a-development-only-admin-password');
  vi.mocked(createDailyAdminWorkflow).mockReturnValue({ searchPlayers, previewPlayer, getHorizon } as never);
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('primary private player editor POST', () => {
  it('rejects cross-site, unauthorized, URL values and malformed input before repository access', async () => {
    expect((await POST(request('q=Player', { site: 'cross-site' }))).status).toBe(403);
    expect((await POST(request('q=Player', { auth: 'Basic bad' }))).status).toBe(401);
    expect((await POST(request('q=Player', { url: 'https://example.test/admin/daily/players?q=private' }))).status).toBe(415);
    for (const body of ['', 'q=x', 'q=foo&q=bar', 'q=foo&extra=1', 'q=foo%0Abar', 'playerId=p1&puzzleDate=2030-01-01&slot=1&slot=2'])
      expect((await POST(request(body))).status).toBe(400);
    expect((await POST(request('q=' + 'x'.repeat(2000)))).status).toBe(413);
    expect(createDailyAdminContext).not.toHaveBeenCalled();
  });
  it('bounds and allowlists search results and does not cache or expose implementation data', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const data = await response.json() as { results: unknown[]; mayHaveMore: boolean }; expect(data.results).toHaveLength(10); expect(data.mayHaveMore).toBe(true);
    expect(JSON.stringify(data)).not.toContain('DO_NOT_RETURN');
  });
  it('signals a possible truncation when the real search helper reaches its ten-result limit', async () => {
    const source = Array.from({ length: 30 }, (_, i) => ({ id: `id${i}`, displayName: `Player ${i}`, aliases: [] }));
    const actual = searchCanonicalPlayers('Player', source);
    expect(actual).toHaveLength(10);
    vi.mocked(createDailyAdminWorkflow).mockReturnValueOnce({ searchPlayers: () => actual.map(result => ({
      canonicalPlayerId: result.playerId, displayName: result.displayName, yearsPlayedDisplay: '',
      requiresYearDisambiguation: false, playerType: 'Batter', primaryPosition: 'CF',
      teamsDisplay: '', recognizabilityRank: null, revealReady: true,
    })) } as never);
    const data = await (await POST(request())).json() as { results: unknown[]; mayHaveMore: boolean };
    expect(data.results).toHaveLength(10); expect(data.mayHaveMore).toBe(true);
  });
  it('only previews a selected horizon slot and projects the game preview', async () => {
    expect((await POST(request('playerId=p1&puzzleDate=2030-01-02&slot=1'))).status).toBe(404);
    expect(previewPlayer).not.toHaveBeenCalled();
    const response = await POST(request('playerId=p1&puzzleDate=2030-01-01&slot=1'));
    expect(response.status).toBe(200);
    const data = await response.json() as { preview: { canonicalPlayerId: string; hints: unknown[] } }; expect(data.preview.canonicalPlayerId).toBe('p1');
    expect(data.preview.hints).toEqual([{ hintLabel: 'Hint', hintValue: 'Allowed' }]);
    expect(JSON.stringify(data)).not.toContain('DO_NOT_RETURN');
  });
  it('redacts internal errors', async () => {
    vi.mocked(createDailyAdminContext).mockImplementationOnce(() => { throw new Error('PRIVATE_VALUE'); });
    const response = await POST(request()); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('PRIVATE_VALUE');
  });
});
