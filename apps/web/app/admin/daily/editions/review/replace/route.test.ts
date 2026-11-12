import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock('../../../../../serverOfficialDailyEditorialDrafts', () => {
  class OfficialDailyDraftError extends Error {
    constructor(readonly kind: string) { super('PRIVATE_CLUE_MESSAGE'); }
  }
  return { OfficialDailyDraftError, replaceOfficialDailyEditorialDraftPlayer: vi.fn() };
});
import { POST } from './route';
import {
  OfficialDailyDraftError, replaceOfficialDailyEditorialDraftPlayer,
} from '../../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../../serverSupabaseClient';

const BASE_URL = 'https://initial.test/admin/daily/editions/review/replace';
const USER = 'editor';
const AUTH = 'Basic ' + Buffer.from(USER + ':long-development-password-for-testing').toString('base64');
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const FORM = { occurrenceId: ID, expectedRevision: '3', slot: '4',
  canonicalPlayerId: 'fixture-10' };
function request(form: Record<string,string> | URLSearchParams = FORM,
  headers: Record<string,string> = {}, url = BASE_URL) {
  return new Request(url, { method: 'POST',
    headers: { authorization: AUTH, origin: new URL(url).origin,
      'sec-fetch-site': 'same-origin', ...headers },
    body: form instanceof URLSearchParams ? form : new URLSearchParams(form),
  });
}

beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', 'long-development-password-for-testing');
  vi.mocked(replaceOfficialDailyEditorialDraftPlayer).mockResolvedValue({
    status: 'updated', occurrenceId: ID, revision: 4,
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('authenticated slot replacement adapter', () => {
  it('denies any non-exact flag before authorization or private data access', async () => {
    for (const gate of ['', 'false', 'TRUE', ' true ']) {
      vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', gate);
      expect((await POST(request())).status).toBe(404);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it('rejects cross-site, same-site and ambiguous Origin-less forms', async () => {
    expect((await POST(request(FORM, { origin: 'https://other.test' }))).status).toBe(403);
    for (const site of ['cross-site','same-site',null]) {
      const req = new Request(BASE_URL, { method: 'POST',
        headers: { authorization: AUTH,
          ...(site === null ? {} : { 'sec-fetch-site': site }) },
        body: new URLSearchParams(FORM),
      });
      expect((await POST(req)).status).toBe(403);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it('rejects wrong principal, media type and unexpected query', async () => {
    const denied = await POST(request(FORM, { authorization: 'Basic wrong' }));
    expect(denied.status).toBe(401);
    expect(denied.headers.get('www-authenticate')).toContain('Daily Admin');
    expect((await POST(request(FORM, { 'content-type': 'application/json' }))).status).toBe(415);
    expect((await POST(request(FORM, {}, BASE_URL + '?unexpected=1'))).status).toBe(415);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it('rejects extra, duplicate, missing or malformed fields before writer access', async () => {
    const duplicate = new URLSearchParams(FORM);
    duplicate.append('slot','5');
    for (const value of [
      { ...FORM, expectedRevision: '03' },
      { ...FORM, expectedRevision: '-1' },
      { ...FORM, slot: '0' }, { ...FORM, slot: '10' },
      { ...FORM, canonicalPlayerId: '' },
      { ...FORM, canonicalPlayerId: ' fixture-10' },
      { ...FORM, occurrenceId: 'daily-ed-v1-' + ID },
      { ...FORM, extra: 'field' }, duplicate,
    ]) expect((await POST(request(value))).status).toBe(400);
    expect(replaceOfficialDailyEditorialDraftPlayer).not.toHaveBeenCalled();
  });
  it('rejects oversized actual body bytes despite forged Content-Length', async () => {
    const req = request({ ...FORM, canonicalPlayerId: 'x'.repeat(2000) },
      { 'content-length': '10' });
    expect((await POST(req)).status).toBe(413);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it('uses exact UUID, expected revision and slot then redirects to private review', async () => {
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://initial.test/admin/daily/editions/review?occurrenceId=' + ID);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(replaceOfficialDailyEditorialDraftPlayer).toHaveBeenCalledWith(
      expect.anything(), ID, 3, 4, 'fixture-10', USER);
  });
  it('accepts the initial draft revision zero with the final batting-order slot', async () => {
    const response = await POST(request({ ...FORM, expectedRevision: '0', slot: '9' }));
    expect(response.status).toBe(303);
    expect(replaceOfficialDailyEditorialDraftPlayer).toHaveBeenCalledWith(
      expect.anything(), ID, 0, 9, 'fixture-10', USER);
  });

  it('returns stale revision 409 and sanitized provider errors without leaking clues', async () => {
    for (const [kind, status] of [
      ['conflict',409], ['invalid',400], ['unavailable',503],
    ] as const) {
      vi.mocked(replaceOfficialDailyEditorialDraftPlayer)
        .mockRejectedValueOnce(new OfficialDailyDraftError(kind));
      const response = await POST(request());
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain('PRIVATE_CLUE_MESSAGE');
    }
  });
});
