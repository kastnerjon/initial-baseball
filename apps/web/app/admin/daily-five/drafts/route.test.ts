import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn(() => ({})) }));
vi.mock('../../../serverCanonicalData', () => ({ resolveCanonicalPlayerId: vi.fn((id: string) => id) }));
vi.mock('../../../getPacificDailyDateString', () => ({ getPacificDailyDateString: vi.fn(() => '2026-10-17') }));
vi.mock('../../../supabaseProspectiveDailyFiveDraftRepository', () => ({
  createSupabaseProspectiveDailyFiveDraftRepository: vi.fn(() => ({ insertDraft: vi.fn() })),
}));

import { POST } from './route';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';
import { resolveCanonicalPlayerId } from '../../../serverCanonicalData';
import { createSupabaseProspectiveDailyFiveDraftRepository }
  from '../../../supabaseProspectiveDailyFiveDraftRepository';

const URL = 'https://example.test/admin/daily-five/drafts';
const AUTH = 'Basic ' + Buffer.from('editor:a-very-long-and-private-editor-password').toString('base64');
const IDS = Array.from({ length: 5 }, (_, i) => 'ibp_' + String(i + 1).padStart(20, '0'));
const saved = { id: 'draft-test-id', puzzleDate: '2027-03-12' };
const insertDraft = vi.fn();

beforeEach(() => {
  vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor');
  vi.stubEnv('DAILY_ADMIN_PASSWORD', 'a-very-long-and-private-editor-password');
  vi.stubEnv('DAILY_FIVE_DRAFT_WRITES_ENABLED', '');
  insertDraft.mockReset();
  vi.mocked(resolveCanonicalPlayerId).mockImplementation(id => id);
  insertDraft.mockResolvedValue(saved);
  vi.mocked(createSupabaseProspectiveDailyFiveDraftRepository).mockReturnValue({
    getByDate: vi.fn(), insertDraft,
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function request(body: unknown = { puzzleDate: saved.puzzleDate, canonicalPlayerIds: IDS },
  headers: Record<string, string> = {}): Request {
  return new Request(URL, {
    method: 'POST', headers: {
      authorization: AUTH, origin: 'https://example.test',
      'content-type': 'application/json', ...headers,
    }, body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('future Daily Five admin draft staging endpoint', () => {
  it('is default off even for correct admin credentials; never touches the database', async () => {
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'draft_writes_not_enabled' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects unauthorized and cross-origin requests before parsing or DB use', async () => {
    const unauthorized = await POST(request('{', { authorization: '' }));
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get('www-authenticate')).toContain('Basic');
    const foreign = await POST(request(undefined, { origin: 'https://attacker.test' }));
    expect(foreign.status).toBe(403);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('fails closed for broken admin configuration', async () => {
    vi.stubEnv('DAILY_ADMIN_PASSWORD', '');
    expect((await POST(request())).status).toBe(503);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON, wrong content type and incorrect five-player selection', async () => {
    vi.stubEnv('DAILY_FIVE_DRAFT_WRITES_ENABLED', 'true');
    for (const bad of [
      request('{'),
      request(null),
      request({ puzzleDate: saved.puzzleDate, canonicalPlayerIds: IDS.slice(0, 4) }),
      request({ puzzleDate: saved.puzzleDate, canonicalPlayerIds: [...IDS.slice(0, 4), IDS[0]] }),
      request({ puzzleDate: 'not-a-date', canonicalPlayerIds: IDS }),
      request({ puzzleDate: saved.puzzleDate, canonicalPlayerIds: ['', ...IDS.slice(1)] }),
    ]) {
      expect((await POST(bad)).status).toBe(400);
    }
    expect((await POST(request(undefined, { 'content-type': 'text/plain' }))).status).toBe(415);
    expect(insertDraft).not.toHaveBeenCalled();
  });

  it('rejects today and historical dates without reading runtime or writing storage', async () => {
    vi.stubEnv('DAILY_FIVE_DRAFT_WRITES_ENABLED', 'true');
    for (const puzzleDate of ['2026-10-17', '2026-10-16', '2026-01-01']) {
      const response = await POST(request({ puzzleDate, canonicalPlayerIds: IDS }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_draft' });
    }
    expect(resolveCanonicalPlayerId).not.toHaveBeenCalled();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects unknown or redirected player identifiers before storage', async () => {
    vi.stubEnv('DAILY_FIVE_DRAFT_WRITES_ENABLED', 'true');
    vi.mocked(resolveCanonicalPlayerId).mockImplementation(id =>
      id === IDS[4] ? null : id);
    expect((await POST(request())).status).toBe(400);
    vi.mocked(resolveCanonicalPlayerId).mockImplementation(id =>
      id === IDS[4] ? IDS[0]! : id);
    expect((await POST(request())).status).toBe(400);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    vi.mocked(resolveCanonicalPlayerId).mockImplementation(() => {
      throw new Error('runtime unavailable');
    });
    expect((await POST(request())).status).toBe(503);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('creates a five-slot marked draft only after an explicit server opt-in', async () => {
    vi.stubEnv('DAILY_FIVE_DRAFT_WRITES_ENABLED', 'true');
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ draftId: saved.id, puzzleDate: saved.puzzleDate });
    expect(insertDraft).toHaveBeenCalledTimes(1);
    expect(insertDraft).toHaveBeenCalledWith(expect.objectContaining({
      puzzleDate: saved.puzzleDate, lineupContractVersion: 2, revision: 0,
      status: 'draft', createdBy: 'editor',
      selections: IDS.map((canonicalPlayerId, index) => ({
        slot: index + 1, canonicalPlayerId, source: 'manual',
      })),
    }));
  });

  it('distinguishes a duplicate date from a provider failure without revealing data', async () => {
    vi.stubEnv('DAILY_FIVE_DRAFT_WRITES_ENABLED', 'true');
    const { SupabaseDailyPuzzleRepositoryError } = await import('../../../supabaseDailyPuzzleRowCodec');
    insertDraft.mockRejectedValueOnce(new SupabaseDailyPuzzleRepositoryError('conflict', 'secret'))
      .mockRejectedValueOnce(new Error('internal provider credentials'));
    expect((await POST(request())).status).toBe(409);
    const unavailable = await POST(request());
    expect(unavailable.status).toBe(503);
    expect(JSON.stringify(await unavailable.json())).not.toContain('credentials');
  });
});
