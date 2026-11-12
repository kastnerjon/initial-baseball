import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ rpc: vi.fn() })),
}));
vi.mock('../../../../serverOfficialDailyIssuance', () => {
  class OfficialDailyIssueError extends Error {
    constructor(readonly kind: 'invalid' | 'conflict' | 'unavailable') {
      super('private-player-and-future-hint');
    }
  }
  return { OfficialDailyIssueError, issuePrivateOfficialDaily: vi.fn() };
});

import { POST } from './route';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';
import { OfficialDailyIssueError, issuePrivateOfficialDaily } from '../../../../serverOfficialDailyIssuance';

const BASE_URL = 'https://initial.test/admin/daily/editions/issue';
const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const occurrenceId = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const puzzleId = 'daily-ed-v1-' + occurrenceId;
const BODY = { occurrenceId, expectedRevision: 1 };

/** Build an authenticated admin POST with no browser-controlled server state. */
function request(body: unknown = BODY, headers: Record<string, string> = {}, url = BASE_URL) {
  return new Request(url, {
    method: 'POST',
    headers: {
      origin: new URL(url).origin,
      'content-type': 'application/json',
      authorization: AUTH,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', PASSWORD);
  vi.mocked(issuePrivateOfficialDaily).mockResolvedValue({ status: 'created', puzzleId });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe('restricted official Daily edition issuance', () => {
  it('is hidden unless both independently gated flags are enabled', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', '');
    expect((await POST(request())).status).toBe(404);
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', 'true');
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'false');
    expect((await POST(request())).status).toBe(404);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects cross-origin submission and missing admin credentials', async () => {
    expect((await POST(request(BODY, { origin: 'https://evil.test' }))).status).toBe(403);
    const denied = await POST(request(BODY, { authorization: 'Bearer visitor' }));
    expect(denied.status).toBe(401);
    expect(denied.headers.get('www-authenticate')).toContain('Daily Admin');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('publishes only metadata through a bounded, authenticated JSON command', async () => {
    const result = await POST(request());
    expect(result.status).toBe(201);
    const serialized = await result.clone().text();
    expect(await result.json()).toEqual({ status: 'created', puzzleId });
    expect(serialized).not.toContain('private-player');
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    expect(issuePrivateOfficialDaily).toHaveBeenCalledWith(
      expect.anything(), occurrenceId, 1,
    );
  });

  it('returns 200 for a verified idempotent retry', async () => {
    vi.mocked(issuePrivateOfficialDaily).mockResolvedValueOnce({ status: 'existing', puzzleId });
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ status: 'existing', puzzleId });
  });

  it('rejects extra body fields, query parameters and overlong bodies', async () => {
    const extra = await POST(request({ ...BODY, admin: true }));
    expect(extra.status).toBe(400);
    const query = await POST(request(BODY, {}, BASE_URL + '?verbose=1'));
    expect(query.status).toBe(415);
    const large = await POST(request({ ...BODY, padding: 'x'.repeat(2500) }));
    expect(large.status).toBe(413);
    expect(issuePrivateOfficialDaily).not.toHaveBeenCalled();
  });

  it('maps immutable conflicts to a sanitized, answer-free response', async () => {
    vi.mocked(issuePrivateOfficialDaily)
      .mockRejectedValueOnce(new OfficialDailyIssueError('conflict'));
    const result = await POST(request());
    expect(result.status).toBe(409);
    const serialized = await result.clone().text();
    expect(await result.json()).toEqual({ error: 'editorial_conflict' });
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    expect(serialized).not.toContain('private-player');
  });
});
