import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock('../../../../serverOfficialDailyEditorialDrafts', () => {
  class OfficialDailyDraftError extends Error {
    constructor(readonly kind: string) { super('PRIVATE_FUTURE_ANSWER'); }
  }
  return { OfficialDailyDraftError, createOfficialDailyEditorialDraft: vi.fn() };
});
import { POST } from './route';
import {
  OfficialDailyDraftError, createOfficialDailyEditorialDraft,
} from '../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';

const BASE_URL = 'https://initial.test/admin/daily/editions/create';
const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const PAYLOAD = {
  puzzleDate: '2026-12-05', editionKey: 'modern', editionNumber: '2',
  title: 'Modern',
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [
    'canonicalPlayerId' + (i + 1), 'fixture-' + (i + 1),
  ])),
};
function request(
  params: Record<string, string> | URLSearchParams = PAYLOAD,
  headers: Record<string, string> = {},
  url = BASE_URL,
): Request {
  return new Request(url, { method: 'POST',
    headers: {
      authorization: AUTH, origin: new URL(url).origin,
      'sec-fetch-site': 'same-origin', ...headers,
    },
    body: params instanceof URLSearchParams ? params : new URLSearchParams(params),
  });
}

beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', PASSWORD);
  vi.mocked(createOfficialDailyEditorialDraft)
    .mockResolvedValue({ status: 'created', occurrenceId: ID, revision: 0 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('default-OFF authenticated secondary draft creation form adapter', () => {
  it('does no private I/O unless the feature flag is exactly true', async () => {
    for (const value of ['false', 'TRUE', '', ' true ']) {
      vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', value);
      expect((await POST(request())).status).toBe(404);
    }
    delete process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED;
    expect((await POST(request())).status).toBe(404);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('denies cross-origin, cross-site and ambiguous Origin-less forms before Basic/private I/O', async () => {
    expect((await POST(request(PAYLOAD, { origin: 'https://attacker.test' }))).status)
      .toBe(403);
    for (const site of ['cross-site', 'same-site', null]) {
      const denied = new Request(BASE_URL, { method: 'POST',
        headers: {
          authorization: AUTH,
          ...(site === null ? {} : { 'sec-fetch-site': site }),
        },
        body: new URLSearchParams(PAYLOAD),
      });
      expect((await POST(denied)).status).toBe(403);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('denies incorrect Basic credentials and invalid content type before persistence', async () => {
    const denied = await POST(request(PAYLOAD, { authorization: 'Basic wrong' }));
    expect(denied.status).toBe(401);
    expect(denied.headers.get('www-authenticate')).toContain('Daily Admin');
    expect((await POST(request(PAYLOAD, { 'content-type': 'application/json' }))).status)
      .toBe(415);
    expect((await POST(request(PAYLOAD, {}, BASE_URL + '?spoof=1'))).status).toBe(415);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects missing, extra, duplicate and inconsistent inputs before calling the writer', async () => {
    const duplicate = new URLSearchParams(PAYLOAD);
    duplicate.append('canonicalPlayerId1', 'fixture-10');
    for (const value of [
      { ...PAYLOAD, canonicalPlayerId1: '' },
      { ...PAYLOAD, editionNumber: '1' },
      { ...PAYLOAD, editionNumber: '02' },
      { ...PAYLOAD, editionNumber: '2147483648' },
      { ...PAYLOAD, extra: 'answer' },
      duplicate,
    ]) expect((await POST(request(value))).status).toBe(400);
    expect(createOfficialDailyEditorialDraft).not.toHaveBeenCalled();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('bounds the actual form bytes even when Content-Length lies', async () => {
    const oversized = request({ ...PAYLOAD, title: 'x'.repeat(9000) },
      { 'content-length': '20' });
    expect((await POST(oversized)).status).toBe(413);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('creates a draft only and redirects to its exact private nine-player review', async () => {
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('location')).toBe(
      'https://initial.test/admin/daily/editions/review?occurrenceId=' + ID,
    );
    expect(createOfficialDailyEditorialDraft).toHaveBeenCalledWith(
      expect.anything(), {
        puzzleDate: '2026-12-05', editionKey: 'modern', editionNumber: 2,
        title: 'Modern',
        canonicalPlayerIds: Array.from({ length: 9 }, (_, i) => 'fixture-' + (i + 1)),
      }, USER,
    );
  });

  it('preserves backend idempotent retries and permits default Puzzle N title', async () => {
    vi.mocked(createOfficialDailyEditorialDraft).mockResolvedValueOnce({
      status: 'existing', occurrenceId: ID, revision: 0,
    });
    expect((await POST(request({ ...PAYLOAD, title: '' }))).status).toBe(303);
    expect(createOfficialDailyEditorialDraft).toHaveBeenCalledWith(
      expect.anything(), expect.not.objectContaining({ title: '' }), USER,
    );
  });

  it('sanitizes backend conflict and failure responses without reflecting future answers', async () => {
    for (const [kind, status] of [
      ['invalid', 400], ['conflict', 409], ['unavailable', 503],
    ] as const) {
      vi.mocked(createOfficialDailyEditorialDraft)
        .mockRejectedValueOnce(new OfficialDailyDraftError(kind));
      const res = await POST(request());
      expect(res.status).toBe(status);
      expect(await res.text()).not.toContain('PRIVATE_FUTURE_ANSWER');
    }
  });
});
