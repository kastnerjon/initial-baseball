import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock('../../../../serverOfficialDailyEditorialDrafts', () => {
  class OfficialDailyDraftError extends Error {
    constructor(readonly kind: string) { super('private-player-hint-diagnostic'); }
  }
  return { OfficialDailyDraftError, readOfficialDailyEditorialDraftPreview: vi.fn() };
});
import { GET } from './route';
import {
  OfficialDailyDraftError, readOfficialDailyEditorialDraftPreview,
} from '../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';

const BASE = 'https://initial.test/admin/daily/editions/preview';
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
function req(query = '?occurrenceId=' + ID, headers: Record<string, string> = {}): Request {
  return new Request(BASE + query, { headers: {
    authorization: AUTH, origin: new URL(BASE).origin, ...headers,
  } });
}
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', PASSWORD);
  vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValue({
    occurrenceId: ID, puzzleDate: '2026-12-05', puzzleNumber: 223,
    editionKey: 'modern', editionNumber: 2, title: 'Modern',
    status: 'draft', revision: 0, canSchedule: true,
    selections: Array.from({ length: 9 }, (_, i) => ({
      slot: i + 1, canonicalPlayerId: 'fixture-' + (i + 1),
      displayName: 'Player ' + (i + 1),
    })),
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('default-OFF exact-draft editor preview route', () => {
  it('does not construct a private client with absent or noncanonical feature flag', async () => {
    for (const value of ['false', 'TRUE', '', ' true ']) {
      vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', value);
      expect((await GET(req())).status).toBe(404);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('checks origin and Basic credentials before any private I/O', async () => {
    expect((await GET(req(undefined, { origin: 'https://attacker.test' }))).status)
      .toBe(403);
    const unauthorized = await GET(req(undefined, { authorization: 'Basic wrong' }));
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get('www-authenticate')).toContain('Daily Admin');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects duplicate, malformed or unexpected query fields before private I/O', async () => {
    for (const query of ['', '?other=1', '?occurrenceId=' + ID + '&occurrenceId=' + ID,
      '?occurrenceId=' + ID + '&debug=1', '?occurrenceId=', '?occurrenceId=invalid']) {
      expect((await GET(req(query))).status).toBe(400);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns nine named selections and revision without hidden hint data', async () => {
    const response = await GET(req());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(body.selections).toHaveLength(9);
    expect(body).toMatchObject({ occurrenceId: ID, revision: 0, canSchedule: true });
    expect(JSON.stringify(body)).not.toContain('hintValues');
    expect(readOfficialDailyEditorialDraftPreview)
      .toHaveBeenCalledWith(expect.anything(), ID);
  });

  it('sanitizes conflict and provider error messages', async () => {
    for (const [kind, status] of [['invalid', 400], ['conflict', 404], ['unavailable', 503]] as const) {
      vi.mocked(readOfficialDailyEditorialDraftPreview)
        .mockRejectedValueOnce(new OfficialDailyDraftError(kind));
      const response = await GET(req());
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain('private-player-hint-diagnostic');
    }
  });
});
