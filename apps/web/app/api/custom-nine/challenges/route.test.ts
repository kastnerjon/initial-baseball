import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../serverCustomNineCreation', () => {
  class ServerCustomNineCreationError extends Error {
    constructor(readonly kind: string) { super('private error, no player clues'); }
  }
  return {
    createServerCustomNineCreationService: vi.fn(),
    ServerCustomNineCreationError,
  };
});

import { POST } from './route';
import {
  createServerCustomNineCreationService,
  ServerCustomNineCreationError,
} from '../../../serverCustomNineCreation';
import { DAILY_ADMIN_AUTH_CHALLENGE } from '../../../dailyAdminAuthorization';

const URL = 'https://example.test/api/custom-nine/challenges';
const AUTH = `Basic ${Buffer.from('editor:a-very-long-and-private-editor-password').toString('base64')}`;
const IDS = Array.from({ length: 9 }, (_, i) => `player-${i + 1}`);
const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const issue = vi.fn();

beforeEach(() => {
  vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor');
  vi.stubEnv('DAILY_ADMIN_PASSWORD', 'a-very-long-and-private-editor-password');
  issue.mockReset();
  issue.mockResolvedValue({ puzzleId: ID });
  vi.mocked(createServerCustomNineCreationService).mockReturnValue({ issue });
});

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function request(body: unknown = { canonicalPlayerIds: IDS }, headers: Record<string, string> = {}) {
  return new Request(URL, {
    method: 'POST',
    headers: { authorization: AUTH, origin: 'https://example.test', 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('private Custom Nine creation POST', () => {
  it('issues only the opaque identifier with a private no-store response', async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ puzzleId: ID });
    expect(issue).toHaveBeenCalledWith({ canonicalPlayerIds: IDS });
    expect(JSON.stringify({ puzzleId: ID })).not.toContain('player-1');
  });

  it('requires pre-existing admin credentials before parsing the request', async () => {
    const response = await POST(request('{', { authorization: '' }));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(DAILY_ADMIN_AUTH_CHALLENGE);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(createServerCustomNineCreationService).not.toHaveBeenCalled();
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
    issue.mockRejectedValueOnce(new ServerCustomNineCreationError(kind));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
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
