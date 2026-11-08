import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock('../../../../../serverOfficialDailyEditorialDrafts', () => {
  class OfficialDailyDraftError extends Error {
    constructor(readonly kind: string) { super('SECRET_PRIVATE_CLUE'); }
  }
  return { OfficialDailyDraftError, scheduleOfficialDailyEditorialDraft: vi.fn() };
});
import { POST } from './route';
import {
  OfficialDailyDraftError, scheduleOfficialDailyEditorialDraft,
} from '../../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../../serverSupabaseClient';

const BASE_URL = 'https://initial.test/admin/daily/editions/review/confirm';
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const payload = { occurrenceId: ID, expectedRevision: '3', confirmed: 'yes' };
function req(data: Record<string, string> | URLSearchParams = payload,
  header: Record<string,string> = {}, url = BASE_URL) {
  return new Request(url, {
    method: 'POST', headers: {
      authorization: AUTH, origin: new URL(url).origin, ...header,
    },
    body: data instanceof URLSearchParams ? data : new URLSearchParams(data),
  });
}
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', PASSWORD);
  vi.mocked(scheduleOfficialDailyEditorialDraft).mockResolvedValue({
    status: 'scheduled', occurrenceId: ID, revision: 4,
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('explicit private editor review-confirm scheduling adapter', () => {
  it('is default OFF before authentication, body reading or private I/O', async () => {
    for (const gate of ['', 'false', 'TRUE', ' true ']) {
      vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', gate);
      expect((await POST(req())).status).toBe(404);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects cross-origin posts and missing Basic credentials before database access', async () => {
    expect((await POST(req(payload, { origin: 'https://other.test' }))).status).toBe(403);
    const denied = await POST(req(payload, { authorization: 'Basic wrong' }));
    expect(denied.status).toBe(401);
    expect(denied.headers.get('www-authenticate')).toContain('Daily Admin');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects origin-less cross-site, same-site and unclassified browser forms before DB I/O', async () => {
    for (const site of ['cross-site', 'same-site', null]) {
      const request = new Request(BASE_URL, {
        method: 'POST',
        headers: { authorization: AUTH, ...(site === null ? {} : { 'sec-fetch-site': site }) },
        body: new URLSearchParams(payload),
      });
      expect((await POST(request)).status).toBe(403);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(scheduleOfficialDailyEditorialDraft).not.toHaveBeenCalled();
  });

  it('requires urlencoded form media, no query injection, and no duplicate fields', async () => {
    const dup = new URLSearchParams(payload);
    dup.append('confirmed', 'yes');
    for (const request of [
      req(payload, { 'content-type': 'application/json' }),
      req(payload, {}, BASE_URL + '?spoof=1'),
      req(dup),
      req({ ...payload, extra: 'x' }),
      req({ ...payload, confirmed: 'no' }),
      req({ ...payload, expectedRevision: '03' }),
      req({ ...payload, expectedRevision: '-1' }),
      req({ ...payload, occurrenceId: 'daily-ed-v1-' + ID }),
    ]) {
      expect([400,415]).toContain((await POST(request)).status);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects oversized streamed bodies, not only Content-Length claims', async () => {
    const request = req({ ...payload, confirmed: 'yes' + 'x'.repeat(2500) });
    expect((await POST(request)).status).toBe(413);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('schedules precisely the reviewed immutable occurrence and revision', async () => {
    const response = await POST(req());
    expect(response.status).toBe(303);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('location')).toBe(
      'https://initial.test/admin/daily/editions/review?occurrenceId=' + ID,
    );
    expect(scheduleOfficialDailyEditorialDraft)
      .toHaveBeenCalledWith(expect.anything(), ID, 3, USER);
    expect(createServerSupabaseClient).toHaveBeenCalledOnce();
  });

  it('reuses the backend idempotent scheduling response rather than duplicating a write', async () => {
    vi.mocked(scheduleOfficialDailyEditorialDraft).mockResolvedValueOnce({
      status: 'existing', occurrenceId: ID, revision: 4,
    });
    expect((await POST(req())).status).toBe(303);
    expect(scheduleOfficialDailyEditorialDraft).toHaveBeenCalledOnce();
  });

  it('returns a safe 409 for stale editorial revisions and redacts provider details', async () => {
    for (const [kind, expected] of [
      ['conflict', 409], ['invalid', 400], ['unavailable', 503],
    ] as const) {
      vi.mocked(scheduleOfficialDailyEditorialDraft)
        .mockRejectedValueOnce(new OfficialDailyDraftError(kind));
      const response = await POST(req());
      expect(response.status).toBe(expected);
      expect(await response.text()).not.toContain('SECRET_PRIVATE_CLUE');
    }
  });
});
