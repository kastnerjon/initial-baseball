import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../../../serverCustomNineAttemptHints', () => ({
  createServerCustomNineAttemptHintService: vi.fn(),
}));
import { createServerCustomNineAttemptHintService } from '../../../../../../serverCustomNineAttemptHints';
import { POST } from './route';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://example.test/api/custom-nine/challenges/' + ID + '/attempt/hint';
const reveal = vi.fn();
const send = (opts: RequestInit = {}) => POST(
  new Request(URL, {
    method: 'POST', headers: { 'content-type': 'application/json', ...opts.headers },
    body: JSON.stringify({ progressionToken: 'signed-original' }), ...opts,
  }),
  { params: Promise.resolve({ puzzleId: ID }) },
);
beforeEach(() => {
  vi.clearAllMocks();
  reveal.mockResolvedValue({
    kind: 'revealed', progressionToken: 'signed-next', revision: 1,
    hint: { hintType: 'teams', hintLabel: 'Teams', hintValue: '1986 Mets' },
  });
  vi.mocked(createServerCustomNineAttemptHintService).mockReturnValue({ reveal } as never);
});

describe('stateful Custom Nine attempt hint POST', () => {
  it('returns one committed hint with private cache controls and no unrevealed hints', async () => {
    const response = await send({ headers: { cookie: 'signed-cookie' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({
      hint: { hintType: 'teams', hintLabel: 'Teams', hintValue: '1986 Mets' },
      progressionToken: 'signed-next', revision: 1,
    });
    expect(reveal).toHaveBeenCalledWith(ID, 'signed-cookie', 'signed-original');
  });

  it.each([
    ['not_found', 404], ['invalid_credential', 403],
    ['invalid_progression', 400], ['completed', 409], ['conflict', 409],
  ] as const)('maps %s without data leakage', async (kind, status) => {
    reveal.mockResolvedValueOnce({ kind });
    const response = await send();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: kind });
  });

  it('rejects invalid body and other-origin requests before the service', async () => {
    expect((await send({ headers: { origin: 'https://evil.example' } })).status).toBe(403);
    for (const body of ['{}', '{"progressionToken":"x","score":4}', '{"progressionToken":4}', 'bad-json']) {
      expect((await send({ body })).status).toBe(400);
    }
    expect(reveal).not.toHaveBeenCalled();
  });

  it('returns sanitized 503 for private storage/signing or puzzle errors', async () => {
    reveal.mockRejectedValueOnce(new Error('SUPABASE_SECRET_INTERNAL'));
    const response = await send();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"session_unavailable"}');
  });
});
