import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../../../../serverCustomNineIncorrectGuesses', () => ({
  createServerCustomNineIncorrectGuessService: vi.fn(),
}));
vi.mock('../../../../../../serverCustomNineTerminalResolve', () => ({
  createServerCustomNineTerminalResolutionService: vi.fn(),
}));
import { createServerCustomNineIncorrectGuessService } from '../../../../../../serverCustomNineIncorrectGuesses';
import { createServerCustomNineTerminalResolutionService } from '../../../../../../serverCustomNineTerminalResolve';
import { POST } from './route';
const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://example.test/api/custom-nine/challenges/' + ID + '/attempt/resolve';
const wrong = vi.fn(), terminal = vi.fn();
const send = (body: unknown, headers: Record<string, string> = {}) => POST(
  new Request(URL, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }), { params: Promise.resolve({ puzzleId: ID }) },
);
beforeEach(() => {
  vi.clearAllMocks();
  wrong.mockResolvedValue({ kind: 'incorrect', progressionToken: 'saved-wrong',
    revision: 1, strikeCount: 1 });
  terminal.mockResolvedValue({ kind: 'terminal', revision: 2, progressionToken: 'saved-terminal',
    result: { kind: 'correct', outcome: 'HR' }, reveal: { displayName: 'PLAYER' },
    hintBundle: { pitchNumber: 2, revealedCount: 0, hints: [], checkpoints: [] },
  });
  vi.mocked(createServerCustomNineIncorrectGuessService).mockReturnValue({ attempt: wrong } as never);
  vi.mocked(createServerCustomNineTerminalResolutionService).mockReturnValue({ resolve: terminal } as never);
});
describe('single Custom Nine guess/Give Up attempt endpoint', () => {
  it('routes incorrect guesses through the private #372 seam, not the terminal resolver', async () => {
    const r = await send({ progressionToken: 'old', submittedPlayerId: 'guessed' }, { cookie: 'attempt=valid' });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(await r.json()).toEqual({
      kind: 'incorrect', strikeCount: 1, progressionToken: 'saved-wrong', revision: 1,
    });
    expect(wrong).toHaveBeenCalledWith(ID, 'attempt=valid',
      { progressionToken: 'old', submittedPlayerId: 'guessed' });
    expect(terminal).not.toHaveBeenCalled();
  });
  it('uses the terminal service only after terminal_pending, and on explicit Give Up', async () => {
    wrong.mockResolvedValueOnce({ kind: 'terminal_pending' });
    const a = await send({ progressionToken: 'old', submittedPlayerId: 'correct' });
    expect(a.status).toBe(200);
    expect(await a.json()).toMatchObject({
      kind: 'terminal', result: { kind: 'correct', outcome: 'HR' },
      progressionToken: 'saved-terminal', hintBundle: { hints: [], checkpoints: [] },
    });
    const b = await send({ progressionToken: 'next', giveUp: true });
    expect(b.status).toBe(200);
    expect(wrong).toHaveBeenCalledTimes(1);
    expect(terminal).toHaveBeenCalledTimes(2);
  });
  it('maps all state failures to sanitized HTTP without calling terminal', async () => {
    for (const [kind, code] of [
      ['not_found', 404], ['invalid_credential', 403], ['invalid_progression', 400],
      ['completed', 409], ['conflict', 409],
    ] as const) {
      wrong.mockResolvedValueOnce({ kind });
      const r = await send({ progressionToken: 'old', submittedPlayerId: 'x' });
      expect(r.status).toBe(code);
      expect(await r.json()).toEqual({ error: kind });
    }
    expect(terminal).not.toHaveBeenCalled();
  });
  it('rejects client selected facts, invalid forms and foreign origins', async () => {
    const body = { progressionToken: 'old', submittedPlayerId: 'x' };
    expect((await send(body, { origin: 'https://attacker.test' })).status).toBe(403);
    for (const bad of [{ ...body, outcome: 'HR' }, { ...body, score: 999 },
      { ...body, attemptId: 'chosen' }, { progressionToken: 'old', giveUp: false },
      { progressionToken: 'old', submittedPlayerId: '' }, '{bad-json']) {
      expect((await send(bad)).status).toBe(400);
    }
    expect(wrong).not.toHaveBeenCalled();
    expect(terminal).not.toHaveBeenCalled();
  });
  it('sanitizes storage or engine failures without leaking answer', async () => {
    wrong.mockRejectedValueOnce(new Error('SECRET_SERVER_PLAYER'));
    const r = await send({ progressionToken: 'old', submittedPlayerId: 'x' });
    expect(r.status).toBe(503);
    expect(await r.text()).toBe('{"error":"session_unavailable"}');
  });
});
