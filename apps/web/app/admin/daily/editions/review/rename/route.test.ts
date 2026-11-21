import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock('../../../../../serverOfficialDailyEditorialDrafts', () => {
  class OfficialDailyDraftError extends Error {
    constructor(readonly kind: string) { super('SECRET_PRIVATE_CLUE'); }
  }
  return { OfficialDailyDraftError, renameOfficialDailyEditorialDraft: vi.fn() };
});
import { POST } from './route';
import {
  OfficialDailyDraftError, renameOfficialDailyEditorialDraft,
} from '../../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../../serverSupabaseClient';

const BASE_URL = 'https://initial.test/admin/daily/editions/review/rename';
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const payload = { occurrenceId: ID, expectedRevision: '3', title: 'Modern Legends' };
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
  vi.mocked(renameOfficialDailyEditorialDraft).mockResolvedValue({
    status: 'renamed', occurrenceId: ID, revision: 4,
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('private editor future draft title form adapter', () => {
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

  it('denies cross-site, same-site and ambiguous Origin-less rename posts before private I/O', async () => {
    for (const site of ['cross-site', 'same-site', null]) {
      const denied = new Request(BASE_URL, { method: 'POST',
        headers: {
          authorization: AUTH,
          ...(site === null ? {} : { 'sec-fetch-site': site }),
        },
        body: new URLSearchParams(payload),
      });
      expect((await POST(denied)).status).toBe(403);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('requires urlencoded form media, no query injection, and no duplicate fields', async () => {
    const dup = new URLSearchParams(payload);
    dup.append('title', 'Modern Legends');
    for (const request of [
      req(payload, { 'content-type': 'application/json' }),
      req(payload, {}, BASE_URL + '?spoof=1'),
      req(dup),
      req({ ...payload, extra: 'x' }),
      req({ ...payload, title: 'ab' }),
      req({ ...payload, title: '<script>' }),
      req({ ...payload, title: 'bad\nname' }),
      req({ ...payload, actorId: 'spoofed' }),
      req({ ...payload, expectedRevision: '2147483647' }),
      req({ ...payload, expectedRevision: '03' }),
      req({ ...payload, expectedRevision: '-1' }),
      req({ ...payload, occurrenceId: 'daily-ed-v1-' + ID }),
    ]) {
      expect([400,415]).toContain((await POST(request)).status);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects oversized streamed bodies, not only Content-Length claims', async () => {
    const request = req({ ...payload, title: 'x'.repeat(2500) });
    expect((await POST(request)).status).toBe(413);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects invalid streamed UTF-8 before privileged database construction', async () => {
    const request = new Request(BASE_URL, { method: 'POST', headers: {
      authorization: AUTH, origin: 'https://initial.test',
      'content-type': 'application/x-www-form-urlencoded',
    }, body: new Uint8Array([0xff, 0xfe]) });
    expect((await POST(request)).status).toBe(413);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('renames only the reviewed occurrence with server principal and normalized title', async () => {
    const response = await POST(req({ ...payload, title: '  Modern   Legends  ' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('location')).toBe(
      'https://initial.test/admin/daily/editions/review?occurrenceId=' + ID,
    );
    expect(renameOfficialDailyEditorialDraft)
      .toHaveBeenCalledWith(expect.anything(), ID, 3, 'Modern Legends', USER);
    expect(createServerSupabaseClient).toHaveBeenCalledOnce();
  });

  it('redacts unexpected provider failures with no-store response headers', async () => {
    vi.mocked(renameOfficialDailyEditorialDraft).mockRejectedValueOnce(new Error('SECRET_PRIVATE_CLUE'));
    const response = await POST(req());
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(await response.text()).not.toContain('SECRET_PRIVATE_CLUE');
  });

  it('returns a safe 409 for stale editorial revisions and redacts provider details', async () => {
    for (const [kind, expected] of [
      ['conflict', 409], ['invalid', 400], ['unavailable', 503],
    ] as const) {
      vi.mocked(renameOfficialDailyEditorialDraft)
        .mockRejectedValueOnce(new OfficialDailyDraftError(kind));
      const response = await POST(req());
      expect(response.status).toBe(expected);
      expect(await response.text()).not.toContain('SECRET_PRIVATE_CLUE');
    }
  });
});
