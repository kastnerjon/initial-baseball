import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../../serverCustomNineHints', () => ({
  createServerCustomNineHintService: vi.fn(),
  CustomNineHintRequestError: class CustomNineHintRequestError extends Error {},
}));

import { createServerCustomNineHintService, CustomNineHintRequestError } from '../../../../../serverCustomNineHints';
import { POST } from './route';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const URI = 'https://example.test/api/custom-nine/challenges/' + ID + '/resolve';
const resolveAtBat = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerCustomNineHintService).mockReturnValue({
    resolveAtBat,
  } as unknown as ReturnType<typeof createServerCustomNineHintService>);
  resolveAtBat.mockResolvedValue({
    result: { kind: 'incorrect', strikeCount: 1 },
    reveal: null, progressionToken: 'next-custom-token',
    hintBundle: { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
  });
});

function request(raw: string, id = ID) {
  return POST(new Request(URI, {
    method: 'POST', body: raw, headers: { 'content-type': 'application/json' },
  }), { params: Promise.resolve({ puzzleId: id }) });
}

describe('Custom Nine signed resolution route', () => {
  it('accepts a guess or Give Up with only the validated fields and no-store', async () => {
    const guessed = await request(JSON.stringify({ progressionToken: 'signed', submittedPlayerId: 'ibp_valid' }));
    expect(guessed.status).toBe(200);
    expect(guessed.headers.get('cache-control')).toBe('private, no-store');
    expect(resolveAtBat).toHaveBeenCalledWith(ID, {
      progressionToken: 'signed', submittedPlayerId: 'ibp_valid',
    });
    const giveUp = await request(JSON.stringify({ progressionToken: 'signed', giveUp: true }));
    expect(giveUp.status).toBe(200);
    expect(resolveAtBat).toHaveBeenCalledWith(ID, { progressionToken: 'signed', giveUp: true });
    expect((await guessed.json() as { reveal: unknown }).reveal).toBeNull();
  });

  it('allows only the explicitly projected terminal answer from the trusted runtime', async () => {
    resolveAtBat.mockResolvedValueOnce({
      result: { kind: 'correct' },
      reveal: { playerId: 'ibp_terminal', displayName: 'Resolved Player' },
      progressionToken: 'signed-successor',
      hintBundle: null,
    });
    const reply = await request(JSON.stringify({ progressionToken: 'signed', giveUp: true }));
    expect((await reply.json() as { reveal: unknown }).reveal).toMatchObject({ playerId: 'ibp_terminal' });
  });

  it.each([
    '{', 'null', '[]', '{}',
    '{"progressionToken":5,"giveUp":true}',
    '{"progressionToken":"signed","giveUp":false}',
    '{"progressionToken":"signed","submittedPlayerId":null}',
    '{"progressionToken":"signed","submittedPlayerId":""}',
    '{"progressionToken":"signed","giveUp":true,"submittedPlayerId":"ibp_hidden"}',
    '{"progressionToken":"signed","giveUp":true,"rulesetVersion":"points-v3"}',
    '{"progressionToken":"signed","submittedPlayerId":"ibp_valid","extra":5}',
    ' '.repeat(4097),
  ])('rejects bad shapes and overlong input without invoking resolution', async raw => {
    const reply = await request(raw);
    expect(reply.status).toBe(400);
    expect(reply.headers.get('cache-control')).toBe('private, no-store');
    expect(await reply.json()).toEqual({ error: 'invalid_progression' });
    expect(resolveAtBat).not.toHaveBeenCalled();
  });

  it('sanitizes missing challenges, invalid tokens, and provider or reveal-shard faults', async () => {
    resolveAtBat.mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new CustomNineHintRequestError())
      .mockRejectedValueOnce(new Error('INTERNAL_FAULT_SENTINEL'));
    const missing = await request(JSON.stringify({ progressionToken: 'signed', giveUp: true }), 'missing');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    const invalid = await request(JSON.stringify({ progressionToken: 'forged', giveUp: true }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'invalid_progression' });
    const fault = await request(JSON.stringify({ progressionToken: 'signed', giveUp: true }));
    expect(fault.status).toBe(503);
    expect(await fault.text()).toBe('{"error":"session_unavailable"}');
    expect(fault.headers.get('cache-control')).toBe('private, no-store');
  });
});
