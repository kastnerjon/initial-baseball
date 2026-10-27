import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../serverCustomLineupV2Creation', () => {
  class ServerCustomLineupV2CreationError extends Error {
    constructor(readonly kind: string) { super('private error, no player clues'); }
  }
  return {
    createServerCustomLineupV2CreationService: vi.fn(),
    ServerCustomLineupV2CreationError,
  };
});

import { POST } from './route';
import {
  createServerCustomLineupV2CreationService,
  ServerCustomLineupV2CreationError,
} from '../../../serverCustomLineupV2Creation';
import { DAILY_ADMIN_AUTH_CHALLENGE } from '../../../dailyAdminAuthorization';

const URL = 'https://example.test/api/custom-lineup/challenges';
const AUTH = `Basic ${Buffer.from('editor:a-very-long-and-private-editor-password').toString('base64')}`;
const IDS = Array.from({ length: 5 }, (_, i) => `player-${i + 1}`);
const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const issue = vi.fn();

beforeEach(() => {
  vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor');
  vi.stubEnv('DAILY_ADMIN_PASSWORD', 'a-very-long-and-private-editor-password');
  vi.stubEnv('DAILY_PROGRESSION_SECRET', 'a-test-progression-secret-that-is-long-enough');
  issue.mockReset();
  issue.mockResolvedValue({ puzzleId: ID });
  vi.mocked(createServerCustomLineupV2CreationService).mockReturnValue({ issue, issueAnonymous: vi.fn(), issueForAccount: vi.fn() });
});

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function request(body: unknown = { canonicalPlayerIds: IDS }, headers: Record<string, string> = {}) {
  return new Request(URL, {
    method: 'POST',
    headers: { authorization: AUTH, origin: 'https://example.test', 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('private Custom Lineup v2 creation POST', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('issues only the opaque identifier for %i ordered IDs with private no-store response', async n => {
    const selected = Array.from({ length: n }, (_, i) => 'player-' + (i + 1));
    const response = await POST(request({ canonicalPlayerIds: selected }));
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ puzzleId: ID });
    expect(issue).toHaveBeenCalledWith({ canonicalPlayerIds: selected });
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain(`ib-custom-lineup-creator-v2-${ID}=`);
    expect(cookie).toContain(`Path=/api/custom-lineup/challenges/${ID}`);
    expect(cookie).toContain('HttpOnly; SameSite=Strict; Secure');
    expect(cookie).not.toContain('Domain=');
    expect(JSON.stringify({ puzzleId: ID })).not.toContain('player-1');
    expect(cookie).not.toContain('canonicalPlayerIds=');
  });

  it('rejects a request with a spoofed puzzle ID or duplicate player selection via the private service', async () => {
    issue.mockRejectedValueOnce(new ServerCustomLineupV2CreationError('invalid_selection'));
    const response = await POST(request({ canonicalPlayerIds: ['player-1', 'player-1'], puzzleId: ID }));
    expect(response.status).toBe(400);
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('requires pre-existing admin credentials before parsing the request', async () => {
    const response = await POST(request('{', { authorization: '' }));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(DAILY_ADMIN_AUTH_CHALLENGE);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(createServerCustomLineupV2CreationService).not.toHaveBeenCalled();
  });

  it('denies cross-origin writes even with valid administrator credentials', async () => {
    const response = await POST(request(undefined, { origin: 'https://attacker.test' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(issue).not.toHaveBeenCalled();
  });

  it('returns a generic unavailable response for misconfigured admin credentials', async () => {
    vi.stubEnv('DAILY_ADMIN_PASSWORD', '');
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'creation_unavailable' });
    expect(issue).not.toHaveBeenCalled();
  });

  it('refuses to issue if the creator marker secret is weak', async () => {
    vi.stubEnv('DAILY_PROGRESSION_SECRET', 'short');
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'creation_unavailable' });
    expect(issue).not.toHaveBeenCalled();
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('rejects malformed and oversized bodies prior to issuance', async () => {
    const malformed = await POST(request('not-json'));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_selection' });
    const oversized = await POST(request({ canonicalPlayerIds: IDS, padding: 'x'.repeat(4200) }));
    expect(oversized.status).toBe(413);
    expect(issue).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_selection', 400],
    ['unsupported_players', 422],
    ['immutable_conflict', 409],
  ] as const)('maps %s to a sanitized %i response', async (kind, status) => {
    issue.mockRejectedValueOnce(new ServerCustomLineupV2CreationError(kind));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.has('set-cookie')).toBe(false);
    const responseText = await response.text();
    expect(JSON.parse(responseText)).toEqual({ error: kind });
    expect(responseText).not.toContain('private error');
  });

  it('does not expose provider errors, secret keys, player IDs or hints', async () => {
    issue.mockRejectedValueOnce(new Error('Supabase URL private-key player-8 future-hint'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'creation_unavailable' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
