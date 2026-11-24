import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCanonicalPlayers } from '@initial-baseball/engine';
vi.mock('server-only', () => ({}));
vi.mock('../../../../../dailyAdminComposition', () => ({
  createDailyAdminContext: vi.fn(() => ({ repository: {} })),
}));
vi.mock('../../../../../dailyAdminWorkflow', () => ({
  createDailyAdminWorkflow: vi.fn(),
}));
import { createDailyAdminContext } from '../../../../../dailyAdminComposition';
import { createDailyAdminWorkflow } from '../../../../../dailyAdminWorkflow';
import { POST } from './route';

const AUTH = 'Basic ' + Buffer.from('editor:a-development-only-admin-password').toString('base64');
const candidate = (n: number) => ({
  canonicalPlayerId: 'player-' + n, displayName: 'Player ' + n,
  yearsPlayedDisplay: '1981–1991', requiresYearDisambiguation: false,
  primaryPosition: 'CF', revealReady: true, hintValues: ['SECRET_HINT'],
});
function request(body = 'q=Clemente', options: { url?: string; auth?: string; site?: string; type?: string } = {}) {
  return new Request(options.url ?? 'https://example.test/admin/daily/editions/players/search', {
    method: 'POST', headers: { authorization: options.auth ?? AUTH,
      origin: 'https://example.test', 'sec-fetch-site': options.site ?? 'same-origin',
      'content-type': options.type ?? 'application/x-www-form-urlencoded' }, body,
  });
}
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor');
  vi.stubEnv('DAILY_ADMIN_PASSWORD', 'a-development-only-admin-password');
  vi.mocked(createDailyAdminWorkflow).mockReturnValue({
    searchPlayers: vi.fn(() => Array.from({ length: 30 }, (_, i) => candidate(i + 1))),
  } as never);
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe('private POST player lookup', () => {
  it('fails closed before lookup for disabled flag, cross-site, unauthorized and URL queries', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'false');
    expect((await POST(request())).status).toBe(404);
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
    expect((await POST(request('q=x', { site: 'cross-site' }))).status).toBe(403);
    expect((await POST(request('q=x', { auth: 'Basic wrong' }))).status).toBe(401);
    expect((await POST(request('q=x', { url: 'https://example.test/admin/daily/editions/players/search?q=private' }))).status).toBe(415);
    expect(createDailyAdminContext).not.toHaveBeenCalled();
  });
  it('rejects malformed, extra, duplicate, oversized and control-character input', async () => {
    for (const body of ['', 'q=x', 'q=a&q=b', 'q=valid&extra=1', 'q=' + 'x'.repeat(81), 'q=foo%0Abar']) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect((await POST(request('q=' + 'x'.repeat(2000)))).status).toBe(413);
    expect(createDailyAdminContext).not.toHaveBeenCalled();
  });
  it('returns bounded identity-only results with private no-store headers', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const json = await response.json() as { results: unknown[]; hasMore: boolean };
    expect(json.results).toHaveLength(25);
    expect(json.hasMore).toBe(true);
    expect(JSON.stringify(json)).not.toContain('SECRET_HINT');
    expect(JSON.stringify(json)).not.toContain('hintValues');
  });
  it('demonstrates the actual engine cap arrives with hasMore false, without exposing private data', async () => {
    const synthetic = Array.from({ length: 12 }, (_, index) => ({
      id: 'fixture-' + index, displayName: 'Fixture Player ' + index, aliases: [],
    }));
    const capped = searchCanonicalPlayers('fixture', synthetic);
    expect(capped).toHaveLength(10);
    vi.mocked(createDailyAdminWorkflow).mockReturnValueOnce({
      searchPlayers: vi.fn(() => capped.map(player => ({
        ...candidate(Number(player.playerId.split('-')[1])),
        canonicalPlayerId: player.playerId,
        displayName: player.displayName,
      }))),
    } as never);
    const response = await POST(request('q=fixture'));
    expect(response.status).toBe(200);
    const json = await response.json() as { results: unknown[]; hasMore: boolean };
    expect(json.results).toHaveLength(10);
    expect(json.hasMore).toBe(false);
    expect(JSON.stringify(json)).not.toContain('SECRET_HINT');
  });

  it('redacts provider errors', async () => {
    vi.mocked(createDailyAdminContext).mockImplementationOnce(() => { throw new Error('PRIVATE_VALUE'); });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('PRIVATE_VALUE');
  });
});
