import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../../../serverCustomNineAttemptBootstrap', () => ({
  createServerCustomNineAttemptBootstrap: vi.fn(),
}));

import { createServerCustomNineAttemptBootstrap } from '../../../../../../serverCustomNineAttemptBootstrap';
import { POST } from './route';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://example.test/api/custom-nine/challenges/' + ID + '/attempt/bootstrap';
const bootstrap = vi.fn();
const publicPayload = {
  puzzleId: ID, rulesetVersion: 'points-v4', progressionToken: 'server-signed',
  hintBundle: { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
  atBats: [{ pitchNumber: 1, initials: 'BH' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  bootstrap.mockResolvedValue({
    kind: 'ready', bootstrap: publicPayload,
    setCookie: 'opaque=v1; Path=/api/custom-nine/challenges/' + ID + '; HttpOnly; SameSite=Strict; Secure',
  });
  vi.mocked(createServerCustomNineAttemptBootstrap).mockReturnValue({ bootstrap } as never);
});
const send = (options: RequestInit = {}) => POST(
  new Request(URL, { method: 'POST', ...options }),
  { params: Promise.resolve({ puzzleId: ID }) },
);

describe('Custom Nine opt-in attempt POST', () => {
  it('issues a private no-store opening session and cookie without secrets in the body', async () => {
    const response = await send({ headers: { origin: 'https://example.test' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('set-cookie')).toContain('; HttpOnly; SameSite=Strict; Secure');
    const json = await response.json();
    expect(json).toMatchObject({ attemptMode: 'reserved', puzzleId: ID });
    expect(json).not.toHaveProperty('attemptId');
    expect(json).not.toHaveProperty('browserKeyDigest');
    expect(bootstrap).toHaveBeenCalledWith(ID, null, URL);
  });

  it('returns preview for creators without setting an attempt cookie', async () => {
    bootstrap.mockResolvedValueOnce({ kind: 'preview', bootstrap: publicPayload });
    const response = await send({ headers: { cookie: 'creator=valid' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toMatchObject({ attemptMode: 'creator_preview' });
    expect(bootstrap).toHaveBeenCalledWith(ID, 'creator=valid', URL);
  });

  it.each([['not_found', 404], ['invalid_credential', 403], ['completed', 409]] as const)(
    'returns %s without cookies or private data', async (kind, status) => {
      bootstrap.mockResolvedValueOnce({ kind });
      const response = await send();
      expect(response.status).toBe(status);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(JSON.stringify(await response.json())).not.toContain('signed');
    },
  );

  it('rejects cross-origin requests and request bodies before service', async () => {
    expect((await send({ headers: { origin: 'https://attacker.test' } })).status).toBe(403);
    expect((await send({ body: JSON.stringify({ attemptId: 'chosen' }) })).status).toBe(400);
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('sanitizes internal signer, storage, and identity failures without cookie issuance', async () => {
    bootstrap.mockRejectedValueOnce(new Error('PRIVATE_TOKEN_AND_SUPABASE_SECRET'));
    const response = await send();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"attempt_unavailable"}');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
