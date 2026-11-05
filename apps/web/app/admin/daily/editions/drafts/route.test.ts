import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock('../../../../serverOfficialDailyEditorialDrafts', () => {
  class OfficialDailyDraftError extends Error {
    constructor(readonly kind: string) { super('private-player-and-hint'); }
  }
  return {
    OfficialDailyDraftError,
    createOfficialDailyEditorialDraft: vi.fn(),
    scheduleOfficialDailyEditorialDraft: vi.fn(),
  };
});

import { PATCH, POST } from './route';
import {
  createOfficialDailyEditorialDraft,
  OfficialDailyDraftError,
  scheduleOfficialDailyEditorialDraft,
} from '../../../../serverOfficialDailyEditorialDrafts';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';

const URL = 'https://initial.test/admin/daily/editions/drafts';
const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const PLAYERS = Array.from({ length: 9 }, (_, i) => 'fixture-' + (i + 1));
const body = { puzzleDate: '2026-12-05', editionKey: 'modern',
  editionNumber: 2, canonicalPlayerIds: PLAYERS };

function request(method: string, payload: unknown, headers: Record<string, string> = {},
                 url = URL): Request {
  return new Request(url, { method,
    headers: { origin: new URL(url).origin, 'content-type': 'application/json',
      authorization: AUTH, ...headers },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', PASSWORD);
  vi.mocked(createOfficialDailyEditorialDraft).mockResolvedValue(
    { status: 'created', occurrenceId: ID, revision: 0 });
  vi.mocked(scheduleOfficialDailyEditorialDraft).mockResolvedValue(
    { status: 'scheduled', occurrenceId: ID, revision: 1 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('default-disabled official Daily secondary draft admin API', () => {
  it('remains inaccessible unless the exact server feature flag is enabled', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'false');
    expect((await POST(request('POST', body))).status).toBe(404);
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', '');
    expect((await POST(request('POST', body))).status).toBe(404);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects cross-origin requests before authorization or database access', async () => {
    const response = await POST(request('POST', body, { origin: 'https://attacker.test' }));
    expect(response.status).toBe(403);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects incorrect credentials before reading the protected payload', async () => {
    const response = await POST(request('POST', body, { authorization: 'Basic wrong' }));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('Daily Admin');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('creates a private nine-player draft with actor identity from Basic auth only', async () => {
    const response = await POST(request('POST', body));
    expect(response.status).toBe(201);
    const serialized = await response.clone().text();
    expect(await response.json()).toEqual({ status: 'created', occurrenceId: ID, revision: 0 });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(createOfficialDailyEditorialDraft).toHaveBeenCalledWith(
      expect.anything(), body, USER,
    );
    expect(serialized).not.toContain('fixture-');
  });

  it('schedules by server-owned revision and never returns a frozen clue', async () => {
    const response = await PATCH(request('PATCH', { occurrenceId: ID, expectedRevision: 0 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'scheduled', occurrenceId: ID, revision: 1 });
    expect(scheduleOfficialDailyEditorialDraft).toHaveBeenCalledWith(
      expect.anything(), ID, 0, USER,
    );
  });

  it('rejects additional caller-controlled fields on scheduling', async () => {
    const response = await PATCH(request('PATCH', {
      occurrenceId: ID, expectedRevision: 0, issued: true,
    }));
    expect(response.status).toBe(400);
    expect(scheduleOfficialDailyEditorialDraft).not.toHaveBeenCalled();
  });

  it('maps stale revisions to a safe conflict and redacts private failures', async () => {
    vi.mocked(scheduleOfficialDailyEditorialDraft).mockRejectedValueOnce(
      new OfficialDailyDraftError('conflict'),
    );
    const response = await PATCH(request('PATCH', { occurrenceId: ID, expectedRevision: 0 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'editorial_conflict' });
    expect(await response.text()).not.toContain('private-player-and-hint');
  });

  it('rejects oversized JSON bodies before private work', async () => {
    const response = await POST(request('POST', {
      ...body, ignored: 'x'.repeat(9000),
    }));
    expect(response.status).toBe(413);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
