import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./serverCustomNineHints', () => ({
  createServerCustomNineHintService: vi.fn(),
  CustomNineHintRequestError: class CustomNineHintRequestError extends Error {},
}));

import { CustomNineHintRequestError, createServerCustomNineHintService } from './serverCustomNineHints';
import { POST as RESTORE } from './api/custom-nine/challenges/[puzzleId]/hints/route';
import { POST as ADVANCE } from './api/custom-nine/challenges/[puzzleId]/hint/route';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const url = 'https://example.test/api/custom-nine/challenges/' + ID + '/hints';
const getHintBundle = vi.fn();
const revealHint = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerCustomNineHintService).mockReturnValue({ getHintBundle, revealHint });
  getHintBundle.mockResolvedValue({ hintBundle: {
    pitchNumber: 1, revealedCount: 1, hints: [{ hintType: 'teams', hintValue: 'CURRENT' }],
    checkpoints: [{ revealedCount: 2, progressionToken: 'CUSTOM_SIGNED' }],
  } });
  revealHint.mockResolvedValue({ hint: { hintValue: 'CURRENT' }, progressionToken: 'CUSTOM_SIGNED' });
});

function send(
  handler: typeof RESTORE,
  body: unknown,
  puzzleId: string = ID,
  override?: { raw?: string },
): Promise<Response> {
  const request = new Request(url, {
    method: 'POST',
    body: override?.raw ?? JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  return handler(request, { params: Promise.resolve({ puzzleId }) });
}

describe('Custom Nine hint endpoints', () => {
  it('restores current hints and advances exactly one checkpoint with private, no-store', async () => {
    const a = await send(RESTORE, { progressionToken: 'TOKEN' });
    const b = await send(ADVANCE, { progressionToken: 'TOKEN' });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.headers.get('cache-control')).toBe('private, no-store');
    expect(b.headers.get('cache-control')).toBe('private, no-store');
    expect(await a.json()).toEqual(await getHintBundle.mock.results[0]?.value);
    expect(await b.json()).toEqual(await revealHint.mock.results[0]?.value);
    expect(getHintBundle).toHaveBeenCalledWith(ID, 'TOKEN');
    expect(revealHint).toHaveBeenCalledWith(ID, 'TOKEN');
  });

  it.each(['{', 'null', '[]', '{}', '{"progressionToken":2}',
    '{"progressionToken":"T","submittedPlayerId":"ibp_secret"}', ' '.repeat(4097)])(
    'rejects malformed or oversized JSON without calling the backend', async raw => {
      for (const handler of [RESTORE, ADVANCE]) {
        const response = await send(handler, {}, ID, { raw });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'invalid_progression' });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
      }
      expect(getHintBundle).not.toHaveBeenCalled();
      expect(revealHint).not.toHaveBeenCalled();
    });

  it('maps missing challenge to a sanitized 404 and invalid token to 400', async () => {
    getHintBundle.mockResolvedValueOnce(null).mockRejectedValueOnce(new CustomNineHintRequestError());
    expect((await send(RESTORE, { progressionToken: 'TOKEN' })).status).toBe(404);
    const rejected = await send(RESTORE, { progressionToken: 'FORGED' });
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toEqual({ error: 'invalid_progression' });
  });

  it('sanitizes provider and signing errors without reflecting private data', async () => {
    revealHint.mockRejectedValueOnce(new Error('PRIVATE_NAME SERVICE_ROLE_KEY'));
    const response = await send(ADVANCE, { progressionToken: 'TOKEN' });
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"session_unavailable"}');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
