import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../../serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn(() => ({})) }));
vi.mock('../../../../serverOfficialDailyEditorialDrafts', () => {
  class OfficialDailyDraftError extends Error { constructor(readonly kind: string) { super('private roster'); } }
  return { OfficialDailyDraftError, createOfficialDailyEditorialDraft: vi.fn(), parseOfficialDailyDraftInput: vi.fn(),
    readOfficialDailyEditorialDraftPreview: vi.fn(), replaceOfficialDailyEditorialDraftRoster: vi.fn(), scheduleOfficialDailyEditorialDraft: vi.fn() };
});
import { POST } from './route';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';
import { createOfficialDailyEditorialDraft, OfficialDailyDraftError, parseOfficialDailyDraftInput,
  readOfficialDailyEditorialDraftPreview, replaceOfficialDailyEditorialDraftRoster, scheduleOfficialDailyEditorialDraft } from '../../../../serverOfficialDailyEditorialDrafts';

const TOKEN = '0123456789abcdef0123456789abcdef';
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const URL = 'https://initial.test/admin/daily/editions/chatops';
const roster = Array.from({ length: 9 }, (_, i) => 'fixture-' + i);
const draft = { puzzleDate: '2026-12-05', editionKey: 'modern', editionNumber: 2, canonicalPlayerIds: roster };
function request(body: unknown, headers: Record<string, string> = {}, url = URL) {
  return new Request(url, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`,
    'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_CHATOPS_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_CHATOPS_TOKEN', TOKEN);
  vi.mocked(parseOfficialDailyDraftInput).mockReturnValue({ ...draft, title: 'Modern', puzzleNumber: 223,
    selections: roster.map((canonicalPlayerId, i) => ({ slot: i + 1, canonicalPlayerId, source: 'manual' as const })) });
  vi.mocked(createOfficialDailyEditorialDraft).mockResolvedValue({ status: 'created', occurrenceId: ID, revision: 0 });
  vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValue({ occurrenceId: ID, puzzleDate: '2026-12-05',
    puzzleNumber: 223, editionKey: 'modern', editionNumber: 2, title: 'Modern', status: 'draft', revision: 0,
    canSchedule: true, selections: roster.map((canonicalPlayerId, i) => ({ slot: i + 1, canonicalPlayerId, displayName: null })) });
  vi.mocked(scheduleOfficialDailyEditorialDraft).mockResolvedValue({ status: 'scheduled', occurrenceId: ID, revision: 1 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('private official Daily edition ChatOps', () => {
  it('requires both exact feature flags before touching the database', async () => {
    for (const flag of ['OFFICIAL_DAILY_EDITOR_CHATOPS_ENABLED', 'OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED']) {
      vi.stubEnv(flag, 'false'); expect((await POST(request({ action: 'preview', occurrenceId: ID }))).status).toBe(404);
      vi.stubEnv(flag, 'true');
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it('authenticates before reading a payload or constructing a privileged client', async () => {
    expect((await POST(request({ action: 'create', draft }, { authorization: 'Bearer wrong' }))).status).toBe(401);
    vi.stubEnv('DAILY_CHATOPS_TOKEN', 'short');
    expect((await POST(request({ action: 'create', draft }))).status).toBe(503);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it('rejects cross-origin and cross-site requests', async () => {
    expect((await POST(request({ action: 'preview', occurrenceId: ID }, { origin: 'https://evil.test' }))).status).toBe(403);
    expect((await POST(request({ action: 'preview', occurrenceId: ID }, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it('creates a draft with server actor and returns the exact private roster', async () => {
    const r = await POST(request({ action: 'create', draft }));
    expect(r.status).toBe(201); expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(createOfficialDailyEditorialDraft).toHaveBeenCalledWith(expect.anything(), draft, 'chatops:assistant');
    const body = await r.json() as { draft: { selections: { canonicalPlayerId: string }[] } };
    expect(body.draft.selections.map(x => x.canonicalPlayerId)).toEqual(roster);
    expect(scheduleOfficialDailyEditorialDraft).not.toHaveBeenCalled();
  });
  it('reads a draft without writing it', async () => {
    expect((await POST(request({ action: 'preview', occurrenceId: ID }))).status).toBe(200);
    expect(readOfficialDailyEditorialDraftPreview).toHaveBeenCalledWith(expect.anything(), ID);
    expect(createOfficialDailyEditorialDraft).not.toHaveBeenCalled();
    expect(scheduleOfficialDailyEditorialDraft).not.toHaveBeenCalled();
  });
  it('revises a roster only at the requested revision and checks ordered readback', async () => {
    vi.mocked(replaceOfficialDailyEditorialDraftRoster).mockResolvedValueOnce({ status: 'updated', occurrenceId: ID, revision: 1 });
    const prior = await readOfficialDailyEditorialDraftPreview({} as never, ID);
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({ ...prior, revision: 1 });
    const response = await POST(request({ action: 'revise', occurrenceId: ID, expectedRevision: 0, canonicalPlayerIds: roster }));
    expect(response.status).toBe(200);
    expect(replaceOfficialDailyEditorialDraftRoster).toHaveBeenCalledWith(expect.anything(), ID, 0, roster, 'chatops:assistant');
    expect(scheduleOfficialDailyEditorialDraft).not.toHaveBeenCalled();
  });
  it('rejects roster revision when private readback has a different order', async () => {
    vi.mocked(replaceOfficialDailyEditorialDraftRoster).mockResolvedValueOnce({ status: 'updated', occurrenceId: ID, revision: 1 });
    const prior = await readOfficialDailyEditorialDraftPreview({} as never, ID);
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({ ...prior, revision: 1, selections: [...prior.selections].reverse() });
    expect((await POST(request({ action: 'revise', occurrenceId: ID, expectedRevision: 0, canonicalPlayerIds: roster }))).status).toBe(409);
  });
  it('rejects malformed revision envelopes before constructing a privileged client', async () => {
    for (const body of [
      { action: 'revise', occurrenceId: ID, expectedRevision: -1, canonicalPlayerIds: roster },
      { action: 'revise', occurrenceId: ID, expectedRevision: 0, canonicalPlayerIds: roster, actorId: 'spoofed' },
      { action: 'revise', occurrenceId: ID, expectedRevision: 0, canonicalPlayerIds: 'bad' },
    ]) expect((await POST(request(body))).status).toBe(400);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it('rejects mismatched ordered roster readback', async () => {
    const prior = await readOfficialDailyEditorialDraftPreview({} as never, ID);
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({ ...prior, selections: [...prior.selections].reverse() });
    expect((await POST(request({ action: 'create', draft }))).status).toBe(409);
  });
  it('rejects a mismatched puzzle number on create readback', async () => {
    const prior = await readOfficialDailyEditorialDraftPreview({} as never, ID);
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({ ...prior, puzzleNumber: 224 });
    expect((await POST(request({ action: 'create', draft }))).status).toBe(409);
  });
  it('requires exact occurrence, revision and explicit confirmation before scheduling', async () => {
    for (const body of [{ action: 'schedule', occurrenceId: ID, expectedRevision: 0 },
      { action: 'schedule', occurrenceId: ID, expectedRevision: 0, confirmed: false },
      { action: 'schedule', occurrenceId: ID, expectedRevision: -1, confirmed: true },
      { action: 'schedule', occurrenceId: ID, expectedRevision: 0, confirmed: true, actorId: 'evil' }]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(scheduleOfficialDailyEditorialDraft).not.toHaveBeenCalled();
    const prior = await readOfficialDailyEditorialDraftPreview({} as never, ID);
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({ ...prior, status: 'scheduled', revision: 1 });
    expect((await POST(request({ action: 'schedule', occurrenceId: ID, expectedRevision: 0, confirmed: true }))).status).toBe(200);
    expect(scheduleOfficialDailyEditorialDraft).toHaveBeenCalledWith(expect.anything(), ID, 0, 'chatops:assistant');
  });
  it('does not report success when post-write readback no longer matches', async () => {
    expect((await POST(request({ action: 'schedule', occurrenceId: ID, expectedRevision: 0, confirmed: true }))).status).toBe(409);
  });
  it('rejects unexpected fields and oversized payloads before privileged access', async () => {
    expect((await POST(request({ action: 'preview', occurrenceId: ID, extra: true }))).status).toBe(400);
    expect((await POST(request({ action: 'preview', occurrenceId: 'not-a-uuid' }))).status).toBe(400);
    expect((await POST(request({ action: 'preview', occurrenceId: ID }, { 'content-type': 'text/plain' }))).status).toBe(400);
    expect((await POST(request({ action: 'preview', occurrenceId: ID }, {}, URL + '?foo=bar'))).status).toBe(400);
    expect((await POST(request({ action: 'create', draft: { value: 'x'.repeat(9000) } }))).status).toBe(413);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it('redacts private provider and conflict errors', async () => {
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockRejectedValueOnce(new OfficialDailyDraftError('conflict'));
    const r = await POST(request({ action: 'preview', occurrenceId: ID }));
    expect(r.status).toBe(409); expect(await r.text()).not.toContain('private roster');
  });
});
