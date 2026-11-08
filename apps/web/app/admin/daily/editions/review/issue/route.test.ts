import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ rpc: vi.fn() })),
}));
vi.mock('../../../../../serverOfficialDailyIssuance', () => {
  class OfficialDailyIssueError extends Error {
    constructor(readonly kind: string) { super('PRIVATE_FROZEN_ANSWER_AND_CLUES'); }
  }
  return { OfficialDailyIssueError, issuePrivateOfficialDaily: vi.fn() };
});
import { POST } from './route';
import {
  OfficialDailyIssueError, issuePrivateOfficialDaily,
} from '../../../../../serverOfficialDailyIssuance';
import { createServerSupabaseClient } from '../../../../../serverSupabaseClient';

const BASE_URL = 'https://initial.test/admin/daily/editions/review/issue';
const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const PUZZLE_ID = 'daily-ed-v1-' + ID;
const FORM = { occurrenceId: ID, expectedRevision: '1', confirmed: 'yes' };
function request(value: Record<string, string> | URLSearchParams = FORM,
  headers: Record<string,string> = {}, url = BASE_URL): Request {
  return new Request(url, { method: 'POST',
    headers: { authorization: AUTH, origin: new URL(url).origin,
      'sec-fetch-site': 'same-origin', ...headers },
    body: value instanceof URLSearchParams ? value : new URLSearchParams(value),
  });
}
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', PASSWORD);
  vi.mocked(issuePrivateOfficialDaily).mockResolvedValue({
    status: 'created', puzzleId: PUZZLE_ID,
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('restricted reviewed secondary Daily frozen issuance', () => {
  it('requires two separate exact-true flags before private I/O', async () => {
    for (const flag of ['OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED',
      'OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED'] as const) {
      for (const value of ['', 'false', 'TRUE', ' true ']) {
        vi.stubEnv(flag, value);
        expect((await POST(request())).status).toBe(404);
      }
      vi.stubEnv(flag, 'true');
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects cross-origin, cross-site, same-site and ambiguous forms', async () => {
    expect((await POST(request(FORM, { origin: 'https://attacker.test' }))).status)
      .toBe(403);
    for (const site of ['cross-site', 'same-site', null]) {
      const denied = new Request(BASE_URL, { method: 'POST',
        headers: {
          authorization: AUTH,
          ...(site === null ? {} : { 'sec-fetch-site': site }),
        }, body: new URLSearchParams(FORM),
      });
      expect((await POST(denied)).status).toBe(403);
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects incorrect Basic credentials and wrong media/query', async () => {
    const denied = await POST(request(FORM, { authorization: 'Basic wrong' }));
    expect(denied.status).toBe(401);
    expect(denied.headers.get('www-authenticate')).toContain('Daily Admin');
    expect((await POST(request(FORM, { 'content-type': 'application/json' }))).status)
      .toBe(415);
    expect((await POST(request(FORM, {}, BASE_URL + '?debug=1'))).status).toBe(415);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('refuses duplicate, unexpected, missing and noncanonical revision/confirmation', async () => {
    const duplicate = new URLSearchParams(FORM);
    duplicate.append('expectedRevision', '2');
    for (const value of [
      { ...FORM, occurrenceId: 'daily-ed-v1-' + ID },
      { ...FORM, expectedRevision: '0' },
      { ...FORM, expectedRevision: '01' },
      { ...FORM, expectedRevision: '-1' },
      { ...FORM, expectedRevision: '9007199254740999' },
      { ...FORM, confirmed: 'no' },
      { ...FORM, unexpected: 'issue' },
      duplicate,
    ]) expect((await POST(request(value))).status).toBe(400);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('bounds actual body bytes even for a false Content-Length', async () => {
    expect((await POST(request({ ...FORM, confirmed: 'yes' + 'x'.repeat(1800) },
      { 'content-length': '10' }))).status).toBe(413);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('issues exactly the reviewed occurrence/revision and redirects only to private review', async () => {
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('location')).toBe(
      'https://initial.test/admin/daily/editions/review?occurrenceId=' + ID,
    );
    expect(issuePrivateOfficialDaily).toHaveBeenCalledWith(expect.anything(), ID, 1);
    expect(createServerSupabaseClient).toHaveBeenCalledOnce();
  });

  it('forwards a later reviewed revision unchanged to the canonical issuer', async () => {
    expect((await POST(request({ ...FORM, expectedRevision: '4' }))).status).toBe(303);
    expect(issuePrivateOfficialDaily).toHaveBeenCalledWith(expect.anything(), ID, 4);
  });

  it('preserves canonical idempotent readback and redacts all private errors', async () => {
    vi.mocked(issuePrivateOfficialDaily).mockResolvedValueOnce({
      status: 'existing', puzzleId: PUZZLE_ID,
    });
    expect((await POST(request())).status).toBe(303);
    for (const [kind, status] of [
      ['invalid', 400], ['conflict', 409], ['unavailable', 503],
    ] as const) {
      vi.mocked(issuePrivateOfficialDaily)
        .mockRejectedValueOnce(new OfficialDailyIssueError(kind));
      const response = await POST(request());
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain('PRIVATE_FROZEN_ANSWER_AND_CLUES');
    }
  });
});
