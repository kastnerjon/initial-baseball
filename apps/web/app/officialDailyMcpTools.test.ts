import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMcpHandler } from '@modelcontextprotocol/server';
vi.mock('server-only', () => ({}));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock('./serverOfficialDailyEditorialDrafts', () => {
  class OfficialDailyDraftError extends Error {
    constructor(readonly kind: string) { super('private future roster must not leak'); }
  }
  return { OfficialDailyDraftError,
    createOfficialDailyEditorialDraft: vi.fn(), findOfficialDailyEditorialDraftForRecovery: vi.fn(),
    parseOfficialDailyDraftInput: vi.fn(), readOfficialDailyEditorialDraftPreview: vi.fn(),
    replaceOfficialDailyEditorialDraftRoster: vi.fn(), scheduleOfficialDailyEditorialDraft: vi.fn() };
});
vi.mock('./serverOfficialDailyIssuance', () => {
  class OfficialDailyIssueError extends Error {
    constructor(readonly kind: string) { super('private future clues must not leak'); }
  }
  return { OfficialDailyIssueError, issuePrivateOfficialDaily: vi.fn() };
});
import type { SupabaseClient } from '@supabase/supabase-js';
import { createOfficialDailyMcpServer, type OfficialDailyMcpServices } from './officialDailyMcpTools';
import { createOfficialDailyEditorialDraft, findOfficialDailyEditorialDraftForRecovery,
  parseOfficialDailyDraftInput, readOfficialDailyEditorialDraftPreview,
  replaceOfficialDailyEditorialDraftRoster, scheduleOfficialDailyEditorialDraft,
  OfficialDailyDraftError } from './serverOfficialDailyEditorialDrafts';
import { issuePrivateOfficialDaily, OfficialDailyIssueError } from './serverOfficialDailyIssuance';

const id = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const players = Array.from({ length: 9 }, (_, i) => 'fixture-' + i);
const selections = players.map((canonicalPlayerId, i) => ({ slot: i + 1, canonicalPlayerId }));
const draft = { puzzleDate: '2026-12-05', editionKey: 'classic', editionNumber: 2,
  title: 'QA Test', canonicalPlayerIds: players };
const state = { occurrenceId: id, ...draft, status: 'draft' as const, revision: 0, selections };
const services: OfficialDailyMcpServices = {
  createClient: vi.fn(() => ({}) as SupabaseClient),
  search: vi.fn(() => [{ canonicalPlayerId: 'fixture-0', displayName: 'Test Player' }]),
};

async function send(method: string, params?: unknown) {
  const handler = createMcpHandler(() => createOfficialDailyMcpServer('mcp:reviewer', services),
    { responseMode: 'json' });
  const request = new Request('https://qa.initial.test/api/official-daily/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }),
  });
  const response = await handler.fetch(request);
  const payload = await response.text();
  const event = payload.split('\n').find(line => line.startsWith('data: '));
  return { status: response.status, body: JSON.parse(event ? event.slice(6) : payload) as Record<string, any> };
}
async function call(name: string, args: unknown) {
  return send('tools/call', { name, arguments: args });
}
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', 'true');
  vi.mocked(parseOfficialDailyDraftInput).mockReturnValue({ ...draft, puzzleNumber: 225,
    selections: selections.map(item => ({ ...item, source: 'manual' })) });
  vi.mocked(createOfficialDailyEditorialDraft).mockResolvedValue({ status: 'created', occurrenceId: id, revision: 0 });
  vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValue({ ...state, puzzleNumber: 225,
    canSchedule: true, selections: selections.map(item => ({ ...item, displayName: 'Test' })) });
  vi.mocked(replaceOfficialDailyEditorialDraftRoster).mockResolvedValue({ occurrenceId: id, revision: 0 } as any);
  vi.mocked(scheduleOfficialDailyEditorialDraft).mockResolvedValue({ status: 'scheduled', occurrenceId: id, revision: 1 });
  vi.mocked(issuePrivateOfficialDaily).mockResolvedValue({ status: 'created', puzzleId: 'daily-ed-v1-' + id });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('real MCP protocol for private secondary publishing', () => {
  it('advertises 7 separate tools, not one unsafe multi-action publisher', async () => {
    const x = await send('tools/list', {});
    expect(x.status).toBe(200);
    const names = x.body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toHaveLength(7);
    expect(names).toContain('schedule_official_daily_draft');
    expect(names).toContain('issue_official_daily_draft');
  });
  it('privately searches identities without modifying editorial state', async () => {
    const x = await call('search_official_daily_players', { query: 'Test' });
    expect(x.status).toBe(200);
    expect(x.body.result.content[0].text).toContain('Test Player');
    expect(createOfficialDailyEditorialDraft).not.toHaveBeenCalled();
  });
  it('creates and verifies exact nine-player ordered draft; never schedules or issues', async () => {
    const x = await call('create_official_daily_draft', { draft });
    expect(x.status).toBe(200);
    expect(x.body.result.content[0].text).toContain(id);
    expect(createOfficialDailyEditorialDraft).toHaveBeenCalledWith(expect.anything(), draft, 'mcp:reviewer');
    expect(scheduleOfficialDailyEditorialDraft).not.toHaveBeenCalled();
    expect(issuePrivateOfficialDaily).not.toHaveBeenCalled();
  });
  it('looks up exact draft for response-loss recovery without writes', async () => {
    vi.mocked(findOfficialDailyEditorialDraftForRecovery).mockResolvedValueOnce(state as any);
    const x = await call('lookup_official_daily_draft', { puzzleDate: draft.puzzleDate, editionKey: draft.editionKey });
    expect(x.body.result.content[0].text).toContain(id);
    expect(createOfficialDailyEditorialDraft).not.toHaveBeenCalled();
  });
  it('requires explicit confirmed:true and exact revision for schedule and issue', async () => {
    for (const name of ['schedule_official_daily_draft', 'issue_official_daily_draft']) {
      for (const args of [
        { occurrenceId: id, expectedRevision: 0 },
        { occurrenceId: id, expectedRevision: 0, confirmed: false },
        { occurrenceId: id, expectedRevision: 0.5, confirmed: true },
        { occurrenceId: id, expectedRevision: 0, confirmed: true, canonicalPlayerIds: players },
      ]) {
        const x = await call(name, args);
        expect(x.body.result?.isError || x.body.error).toBeTruthy();
      }
    }
    expect(scheduleOfficialDailyEditorialDraft).not.toHaveBeenCalled();
    expect(issuePrivateOfficialDaily).not.toHaveBeenCalled();
  });
  it('schedules with CAS and never issues; issue uses distinct flag and immutable service', async () => {
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({
      ...state, status: 'scheduled', revision: 1,
    } as any);
    const scheduled = await call('schedule_official_daily_draft', { occurrenceId: id, expectedRevision: 0, confirmed: true });
    expect(scheduled.body.result.content[0].text).toContain('scheduled');
    expect(scheduleOfficialDailyEditorialDraft).toHaveBeenCalledTimes(1);
    expect(issuePrivateOfficialDaily).not.toHaveBeenCalled();
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', 'false');
    const closed = await call('issue_official_daily_draft', { occurrenceId: id, expectedRevision: 1, confirmed: true });
    expect(closed.body.result.isError).toBe(true);
    expect(issuePrivateOfficialDaily).not.toHaveBeenCalled();
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', 'true');
    const issued = await call('issue_official_daily_draft', { occurrenceId: id, expectedRevision: 1, confirmed: true });
    expect(issued.body.result.content[0].text).toContain('daily-ed-v1-');
    expect(issuePrivateOfficialDaily).toHaveBeenCalledWith(expect.anything(), id, 1);
  });
  it('redacts service errors and replays existing immutable issue results', async () => {
    vi.mocked(issuePrivateOfficialDaily).mockRejectedValueOnce(new OfficialDailyIssueError('conflict'));
    const stale = await call('issue_official_daily_draft', { occurrenceId: id, expectedRevision: 0, confirmed: true });
    expect(stale.body.result.isError).toBe(true);
    expect(JSON.stringify(stale)).not.toContain('private future clues');
    vi.mocked(issuePrivateOfficialDaily).mockResolvedValueOnce({ status: 'existing', puzzleId: 'daily-ed-v1-' + id });
    const retried = await call('issue_official_daily_draft', { occurrenceId: id, expectedRevision: 1, confirmed: true });
    expect(retried.body.result.content[0].text).toContain('existing');
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockRejectedValueOnce(new OfficialDailyDraftError('unavailable'));
    const error = await call('preview_official_daily_draft', { occurrenceId: id });
    expect(error.body.result.isError).toBe(true);
    expect(JSON.stringify(error)).not.toContain('private future roster');
  });
});
