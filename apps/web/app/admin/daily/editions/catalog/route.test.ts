import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock('../../../../serverOfficialDailyEditorialCatalog', () => {
  class OfficialDailyEditorialCatalogError extends Error {
    constructor(readonly kind: string) { super('PRIVATE_HINT_MARKER'); }
  }
  return {
    OfficialDailyEditorialCatalogError,
    listPrivateOfficialDailyEditorialDrafts: vi.fn(),
  };
});

import { GET } from './route';
import {
  listPrivateOfficialDailyEditorialDrafts,
  OfficialDailyEditorialCatalogError,
} from '../../../../serverOfficialDailyEditorialCatalog';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';

const BASE_URL = 'https://initial.test/admin/daily/editions/catalog';
const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const RESPONSE = {
  puzzleDate: '2026-11-06',
  editions: [{ occurrenceId: ID, puzzleDate: '2026-11-06',
    puzzleNumber: 194, editionKey: 'modern', editionNumber: 2,
    title: 'Modern', status: 'scheduled', revision: 1 }],
  nextCursor: null,
} as const;

function request(query = '?puzzleDate=2026-11-06', headers: Record<string, string> = {}) {
  return new Request(BASE_URL + query, {
    method: 'GET',
    headers: { authorization: AUTH, 'sec-fetch-site': 'same-origin', ...headers },
  });
}

beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', PASSWORD);
  vi.mocked(listPrivateOfficialDailyEditorialDrafts).mockResolvedValue(RESPONSE);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('default-disabled official Daily editorial metadata GET', () => {
  it('returns 404 without authorization or database I/O when disabled', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'false');
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(listPrivateOfficialDailyEditorialDrafts).not.toHaveBeenCalled();
  });

  it('denies cross-origin and missing credentials before database access', async () => {
    expect((await GET(request(undefined, { origin: 'https://attacker.test' }))).status).toBe(403);
    const unauthorized = await GET(request(undefined, { authorization: 'Basic incorrect' }));
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get('www-authenticate')).toContain('Daily Admin');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('denies origin-less cross-site, same-site and unclassified metadata requests', async () => {
    for (const site of ['cross-site', 'same-site', null]) {
      const request = new Request(BASE_URL + '?puzzleDate=2026-11-06', {
        headers: {
          authorization: AUTH,
          ...(site === null ? {} : { 'sec-fetch-site': site }),
        },
      });
      expect((await GET(request)).status).toBe(403);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(listPrivateOfficialDailyEditorialDrafts).not.toHaveBeenCalled();
  });

  it('allows a direct first-party admin catalog lookup with Fetch Metadata none', async () => {
    const request = new Request(BASE_URL + '?puzzleDate=2026-11-06', {
      headers: { authorization: AUTH, 'sec-fetch-site': 'none' },
    });
    expect((await GET(request)).status).toBe(200);
  });

  it('uses the bounded page request with a server-derived authenticated session', async () => {
    const response = await GET(request('?puzzleDate=2026-11-06&afterEditionNumber=2&pageSize=30'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(await response.json()).toEqual(RESPONSE);
    expect(listPrivateOfficialDailyEditorialDrafts).toHaveBeenCalledWith(expect.anything(), {
      puzzleDate: '2026-11-06', afterEditionNumber: 2, pageSize: 30,
    });
    expect(JSON.stringify(RESPONSE)).not.toContain('canonicalPlayerIds');
  });

  it.each([
    '', '?pageSize=10', '?puzzleDate=2026-02-30',
    '?puzzleDate=2026-11-06&pageSize=0',
    '?puzzleDate=2026-11-06&pageSize=1e3',
    '?puzzleDate=2026-11-06&afterEditionNumber=-2',
    '?puzzleDate=2026-11-06&afterEditionNumber=9007199254740992',
    '?puzzleDate=2026-11-06&puzzleDate=2026-11-07',
    '?puzzleDate=2026-11-06&includePlayers=true',
  ])('rejects invalid and ambiguous query %s without leaking private content', async query => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(listPrivateOfficialDailyEditorialDrafts).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: 'invalid_request' });
  });

  it('redacts storage failures, preserving a generic no-store response', async () => {
    vi.mocked(listPrivateOfficialDailyEditorialDrafts)
      .mockRejectedValueOnce(new OfficialDailyEditorialCatalogError('unavailable'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    const serialized = await response.clone().text();
    expect(await response.json()).toEqual({ error: 'unavailable' });
    expect(serialized).not.toContain('PRIVATE_HINT_MARKER');
  });
});
