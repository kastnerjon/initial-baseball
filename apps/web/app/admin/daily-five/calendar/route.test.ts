import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock('../../../supabaseDailyEditorialCalendarOccupancy', () => ({
  createSupabaseDailyEditorialCalendarOccupancyReader: vi.fn(),
}));

import { GET } from './route';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';
import { createSupabaseDailyEditorialCalendarOccupancyReader } from '../../../supabaseDailyEditorialCalendarOccupancy';
const DATE = '2026-11-18';
const AUTH = 'Basic ' + Buffer.from('editor:a-very-long-and-private-editor-password').toString('base64');
const getByDate = vi.fn();
const getHorizon = vi.fn();

beforeEach(() => {
  vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor');
  vi.stubEnv('DAILY_ADMIN_PASSWORD', 'a-very-long-and-private-editor-password');
  getByDate.mockReset();
  getHorizon.mockReset();
  vi.mocked(createSupabaseDailyEditorialCalendarOccupancyReader).mockReturnValue({ getByDate, getHorizon });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
function request(date = DATE, authorization = AUTH): Request {
  return new Request('https://example.test/admin/daily-five/calendar?date='
    + encodeURIComponent(date), { headers: { authorization } });
}

describe('private Daily Five editorial calendar inspection', () => {
  it('rejects unauthenticated access before querying the database', async () => {
    const response = await GET(request(DATE, ''));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('Basic');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it.each(['', '2026-02-30', '2026-13-01', 'nope', '2026-11-18x'])
  ('rejects invalid date %s without any query', async date => {
    const response = await GET(request(date));
    expect(response.status).toBe(400);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns minimal versioned occupancy for contract 1 or 2; omits player answers', async () => {
    for (const contract of [1, 2] as const) {
      const occupancy = { puzzleDate: DATE, lineupContractVersion: contract, status: 'draft' };
      getByDate.mockResolvedValueOnce(occupancy);
      const response = await GET(request());
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      const json = await response.json();
      expect(json).toEqual({ date: DATE, occupancy });
      expect(JSON.stringify(json)).not.toContain('canonicalPlayerId');
    }
    expect(getByDate).toHaveBeenCalledWith(DATE);
  });

  it('returns a real null for free date, never fabricating an occupied or vacant date on errors', async () => {
    getByDate.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('secret SQL'));
    const empty = await GET(request());
    expect(await empty.json()).toEqual({ date: DATE, occupancy: null });
    const failed = await GET(request());
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: 'unavailable' });
  });

  it('offers authenticated read-only mixed-contract horizon without answers', async () => {
    const slots = [
      { date: DATE, occupancy: { puzzleDate: DATE, lineupContractVersion: 1, status: 'scheduled' } },
      { date: '2026-11-19', occupancy: { puzzleDate: '2026-11-19', lineupContractVersion: 2, status: 'draft' } },
      { date: '2026-11-20', occupancy: null },
    ];
    getHorizon.mockResolvedValueOnce(slots);
    const requestRange = new Request(
      'https://example.test/admin/daily-five/calendar?startDate=' + DATE + '&days=3',
      { headers: { authorization: AUTH } },
    );
    const response = await GET(requestRange);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ startDate: DATE, days: 3, slots });
    expect(getHorizon).toHaveBeenCalledWith(DATE, 3);
    expect(getByDate).not.toHaveBeenCalled();
  });

  it.each([
    'startDate=2026-02-30&days=3',
    'startDate=2026-11-18&days=0',
    'startDate=2026-11-18&days=32',
    'startDate=2026-11-18&days=2.5',
    'startDate=2026-11-18',
    'startDate=2026-11-18&days=2&date=2026-11-18',
    'startDate=2026-11-18&days=2&days=3',
    'date=2026-11-18&extra=1',
  ])('rejects malformed or ambiguous range params: %s', async query => {
    const response = await GET(new Request('https://example.test/admin/daily-five/calendar?' + query,
      { headers: { authorization: AUTH } }));
    expect(response.status).toBe(400);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects unauthorized horizon reads and fails closed on provider errors', async () => {
    const url = 'https://example.test/admin/daily-five/calendar?startDate=' + DATE + '&days=2';
    expect((await GET(new Request(url))).status).toBe(401);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    getHorizon.mockRejectedValueOnce(new Error('secret'));
    const failed = await GET(new Request(url, { headers: { authorization: AUTH } }));
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: 'unavailable' });
  });

  it('fails closed when editor auth configuration is unavailable', async () => {
    vi.stubEnv('DAILY_ADMIN_PASSWORD', '');
    expect((await GET(request())).status).toBe(503);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
