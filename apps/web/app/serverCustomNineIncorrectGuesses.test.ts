import { describe, expect, it, vi } from 'vitest';
import { getGuessOutcome } from '@initial-baseball/engine';
import type { DailyResolutionRequest } from './dailyRuntimeContracts';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';

vi.mock('server-only', () => ({}));

import { createCustomNineAttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerCustomNineIncorrectGuessService } from './serverCustomNineIncorrectGuesses';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const SECRET = 'nonterminal-guess-test-secret-at-least-thirty-two-chars';
const tokens = createCustomNineProgressionTokens(SECRET);
const claims = {
  version: 1 as const, rulesetVersion: 'points-v4' as const,
  puzzleId: ID, puzzleDate: CUSTOM_NINE_SESSION_DATE,
  pitchNumber: 1, revealCount: 0 as const, strikeCount: 0 as const,
  outCount: 0 as const, completed: false,
};
const INITIAL = tokens.sign(claims);
const cookie = createCustomNineAttemptBrowserCredential(SECRET).issue(
  ID, 'https://example.test/api/custom-nine/challenges/' + ID + '/attempt/bootstrap',
);
const COOKIE = cookie.setCookie.split(';')[0]!;
const guess = (progressionToken: string, submittedPlayerId = 'not-the-answer'): DailyResolutionRequest =>
  ({ progressionToken, submittedPlayerId });

function setup() {
  let state: CustomNineAttemptState | null = {
    challengeId: ID, browserKeyDigest: cookie.browserKeyDigest,
    attemptId: '123e4567-e89b-42d3-a456-426614174010',
    revision: 0, currentProgressionToken: INITIAL, terminalAtBats: [],
    status: 'active', createdAt: '2026-10-10T12:00:00Z',
    updatedAt: '2026-10-10T12:00:00Z', completedAt: null,
  };
  const repository = {
    getByKey: vi.fn(async () => state === null ? null : structuredClone(state)),
    advance: vi.fn(async (expected: CustomNineAttemptState, action: { progressionToken: string }) => {
      if (state === null || state.status !== 'active'
        || expected.revision !== state.revision
        || expected.currentProgressionToken !== state.currentProgressionToken
        || expected.attemptId !== state.attemptId) return { status: 'conflict' as const };
      state = {
        ...state, currentProgressionToken: action.progressionToken, revision: state.revision + 1,
      };
      return { status: 'advanced' as const, state: structuredClone(state) };
    }),
  };
  const dependencies = {
    challengeExists: vi.fn(async () => true),
    repository: vi.fn(() => repository),
    getSecret: vi.fn(() => SECRET),
    resolve: vi.fn(async (_id: unknown, request: DailyResolutionRequest) => {
      const before = tokens.verify(request.progressionToken);
      const outcome = getGuessOutcome({
        isCorrect: request.submittedPlayerId === 'correct-canonical',
        revealCount: before.revealCount, strikeCount: before.strikeCount, maxStrikes: 3,
      });
      const successor = tokens.sign({
        ...before, strikeCount: outcome.kind === 'incorrect' ? outcome.strikeCount as 1 | 2
          : before.strikeCount,
      });
      return {
        result: outcome, reveal: null, terminalReceipt: null,
        hintBundle: null, progressionToken: successor,
      };
    }),
  };
  return {
    service: createServerCustomNineIncorrectGuessService({ dependencies }),
    repository, dependencies,
    getState: () => state,
    setState: (next: CustomNineAttemptState | null) => { state = next; },
  };
}

describe('private Custom Nine nonterminal incorrect-guess persistence', () => {
  it('commits first and second incorrect guesses and rejects stale replay', async () => {
    const s = setup();
    const first = await s.service.attempt(ID, COOKIE, guess(INITIAL));
    expect(first).toMatchObject({ kind: 'incorrect', strikeCount: 1, revision: 1 });
    if (first.kind !== 'incorrect') throw Error('Expected committed wrong guess');
    expect(tokens.verify(first.progressionToken)).toMatchObject({
      pitchNumber: 1, strikeCount: 1, revealCount: 0,
    });
    expect(await s.service.attempt(ID, COOKIE, guess(INITIAL))).toEqual({ kind: 'conflict' });
    const second = await s.service.attempt(ID, COOKIE, guess(first.progressionToken));
    expect(second).toMatchObject({ kind: 'incorrect', strikeCount: 2, revision: 2 });
    expect(s.getState()).toMatchObject({ revision: 2, terminalAtBats: [] });
    expect(s.repository.advance).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(second)).not.toContain('canonicalPlayerId');
  });

  it('passes the same injected environment to the resolver and Supabase composition', async () => {
    const environment = { CUSTOM_NINE_TEST_ENV: 'explicit-config', DAILY_PROGRESSION_SECRET: SECRET };
    const s = setup();
    const deps = s.dependencies;
    const scoped = createServerCustomNineIncorrectGuessService({ environment, dependencies: deps });
    expect((await scoped.attempt(ID, COOKIE, guess(INITIAL))).kind).toBe('incorrect');
    expect(deps.challengeExists).toHaveBeenCalledWith(ID, environment);
    expect(deps.repository).toHaveBeenCalledWith(environment);
    expect(deps.getSecret).toHaveBeenCalledWith(environment);
    expect(deps.resolve).toHaveBeenCalledWith(ID, guess(INITIAL), environment);
  });

  it('allows exactly one competing write at the same signed predecessor', async () => {
    const s = setup();
    const results = await Promise.all([
      s.service.attempt(ID, COOKIE, guess(INITIAL)),
      s.service.attempt(ID, COOKIE, guess(INITIAL)),
    ]);
    expect(results.map(x => x.kind).sort()).toEqual(['conflict', 'incorrect']);
    expect(s.getState()?.revision).toBe(1);
  });

  it('does not persist or expose correct guesses and third-strike terminal outcomes', async () => {
    const s = setup();
    expect(await s.service.attempt(ID, COOKIE, guess(INITIAL, 'correct-canonical')))
      .toEqual({ kind: 'terminal_pending' });
    expect(s.repository.advance).not.toHaveBeenCalled();
    const twoStrikes = tokens.sign({ ...claims, strikeCount: 2 });
    s.setState({ ...s.getState()!, revision: 2, currentProgressionToken: twoStrikes });
    expect(await s.service.attempt(ID, COOKIE, guess(twoStrikes))).toEqual({ kind: 'terminal_pending' });
    expect(s.repository.advance).not.toHaveBeenCalled();
    expect(s.dependencies.resolve).toHaveBeenCalledOnce();
  });

  it('rejects invalid credentials, creator markers and erased attempts before resolving', async () => {
    const s = setup();
    const creator = createCustomNineCreatorBrowserMarker(SECRET)
      .creatorCookie(ID, 'https://example.test').split(';')[0]!;
    for (const header of [null, COOKIE + '; ' + COOKIE, COOKIE.replace(/.$/, '!'), creator,
      creator.split('=')[0] + '=forged']) {
      expect(await s.service.attempt(ID, header, guess(INITIAL)))
        .toEqual({ kind: 'invalid_credential' });
    }
    s.setState(null);
    expect(await s.service.attempt(ID, COOKIE, guess(INITIAL)))
      .toEqual({ kind: 'invalid_credential' });
    expect(s.dependencies.resolve).not.toHaveBeenCalled();
  });

  it('rejects invalid input or tokens, including foreign challenge and Universal date', async () => {
    const s = setup();
    for (const input of [
      { progressionToken: INITIAL, submittedPlayerId: '' },
      { progressionToken: INITIAL, giveUp: true },
      { progressionToken: INITIAL, submittedPlayerId: 'a'.repeat(201) },
      guess('not-signed'),
      guess(tokens.sign({ ...claims, puzzleId: OTHER })),
      guess(tokens.sign({ ...claims, puzzleDate: '2026-10-10' })),
    ]) {
      expect(await s.service.attempt(ID, COOKIE, input)).toEqual({ kind: 'invalid_progression' });
    }
    expect(await s.service.attempt('unknown-id', COOKIE, guess(INITIAL))).toEqual({ kind: 'not_found' });
    s.dependencies.challengeExists.mockResolvedValueOnce(false);
    expect(await s.service.attempt(OTHER, null, guess(INITIAL))).toEqual({ kind: 'not_found' });
    expect(s.dependencies.resolve).not.toHaveBeenCalled();
    expect(s.repository.advance).not.toHaveBeenCalled();
  });

  it('fails closed on completed or internally inconsistent attempt states', async () => {
    const s = setup();
    s.setState({ ...s.getState()!, status: 'completed', completedAt: '2026-10-11T00:00:00Z' });
    expect(await s.service.attempt(ID, COOKIE, guess(INITIAL))).toEqual({ kind: 'completed' });
    s.setState({ ...s.getState()!, status: 'active', completedAt: null,
      currentProgressionToken: tokens.sign({ ...claims, pitchNumber: 2 }) });
    await expect(s.service.attempt(ID, COOKIE, guess(tokens.sign({ ...claims, pitchNumber: 2 }))))
      .rejects.toThrow('terminal progression integrity unavailable');
    expect(s.repository.advance).not.toHaveBeenCalled();
  });

  it('refuses tampered signed successors and incorrect resolver outcomes', async () => {
    for (const badToken of [
      'unsigned', INITIAL,
      tokens.sign({ ...claims, revealCount: 1, strikeCount: 1 }),
      tokens.sign({ ...claims, strikeCount: 2 }),
      tokens.sign({ ...claims, outCount: 1, strikeCount: 1 }),
      tokens.sign({ ...claims, pitchNumber: 2, strikeCount: 1 }),
    ]) {
      const s = setup();
      s.dependencies.resolve.mockResolvedValueOnce({
        result: getGuessOutcome({ isCorrect: false, revealCount: 0, strikeCount: 0, maxStrikes: 3 }),
        reveal: null, terminalReceipt: null, hintBundle: null, progressionToken: badToken,
      });
      await expect(s.service.attempt(ID, COOKIE, guess(INITIAL))).rejects.toThrow();
      expect(s.repository.advance).not.toHaveBeenCalled();
    }
  });

  it('does not return a guessed player or progression on a CAS losing branch', async () => {
    const s = setup();
    s.repository.advance.mockResolvedValueOnce({ status: 'conflict' } as never);
    expect(await s.service.attempt(ID, COOKIE, guess(INITIAL))).toEqual({ kind: 'conflict' });
  });
});
