import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { createCustomNineAttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createCustomNineTerminalReceiptCodec } from './customNineTerminalReceipt';
import { createServerCustomNineTerminalResolutionService } from './serverCustomNineTerminalResolve';
import { getGuessOutcome } from '@initial-baseball/engine';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { DailyProgressionClaims } from './dailyProgressionToken';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import type { DailyResolutionRequest } from './dailyRuntimeContracts';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const SECRET = 'terminal-resolve-test-secret-at-least-thirty-two-characters';
const codec = createCustomNineProgressionTokens(SECRET);
const claims: DailyProgressionClaims = {
  version: 1, rulesetVersion: 'points-v4', puzzleId: ID,
  puzzleDate: CUSTOM_NINE_SESSION_DATE, pitchNumber: 1,
  revealCount: 0, strikeCount: 0, outCount: 0, completed: false,
};
const browser = createCustomNineAttemptBrowserCredential(SECRET).issue(ID, 'https://example.test');
const cookie = browser.setCookie.split(';')[0]!;
const nextBundle = (pitchNumber: number) => ({
  pitchNumber, revealedCount: 0 as const,
  hints: [{ slot: 1, hintType: 'teams', hintLabel: 'Teams', hintValue: 'UNREVEALED_CLUE' }],
  checkpoints: [{ revealedCount: 1, progressionToken: 'PRE_SIGNED_CHECKPOINT' }],
});
const params = (c: DailyProgressionClaims, giveUp = false): DailyResolutionRequest => ({
  progressionToken: codec.sign(c),
  ...(giveUp ? { giveUp: true } : { submittedPlayerId: 'player_123' }),
});
function response(c: DailyProgressionClaims, mode: 'correct' | 'strikeout' | 'give_up' | 'incorrect') {
  const result = mode === 'give_up' ? {
    kind: 'strikeout' as const, revealedCount: c.revealCount,
    strikeCount: 3, outcome: 'K' as const, source: 'strikeout' as const,
  } : getGuessOutcome({ isCorrect: mode === 'correct', revealCount: c.revealCount,
    strikeCount: mode === 'strikeout' ? 2 : c.strikeCount, maxStrikes: 3 });
  const terminal = mode !== 'incorrect';
  const final = c.pitchNumber === 9;
  const after: DailyProgressionClaims = terminal
    ? { ...c, pitchNumber: final ? 9 : c.pitchNumber + 1,
      strikeCount: 0, revealCount: 0, completed: final,
      outCount: Math.min(c.outCount + (result.kind === 'strikeout' ? 1 : 0), 3) as 0 | 1 | 2 | 3 }
    : { ...c, strikeCount: (c.strikeCount + 1) as 1 | 2 };
  const successor = codec.sign(after);
  const fact: DailyCompletedAtBat | null = !terminal ? null : {
    pitchNumber: c.pitchNumber, initials: 'P' + c.pitchNumber,
    outcome: result.kind === 'incorrect' ? 'K' : result.outcome,
    hintsRevealed: c.revealCount,
    wrongGuesses: mode === 'strikeout' ? 3 : c.strikeCount,
    resolution: mode === 'give_up' ? 'give_up' : mode === 'correct' ? 'correct' : 'strikeout',
  };
  return {
    result, reveal: terminal ? { displayName: 'SERVER_REVEAL' } : null,
    progressionToken: successor,
    hintBundle: final && terminal ? null : nextBundle(after.pitchNumber),
    terminalReceipt: fact === null ? null : createCustomNineTerminalReceiptCodec(SECRET).sign({
      puzzleId: ID, atBat: fact, predecessorToken: codec.sign(c), successorToken: successor,
    }),
  };
}
function setup(c: DailyProgressionClaims = claims, facts: DailyCompletedAtBat[] = []) {
  let row: CustomNineAttemptState | null = {
    challengeId: ID, browserKeyDigest: browser.browserKeyDigest,
    attemptId: '123e4567-e89b-42d3-a456-426614174010',
    revision: facts.length, currentProgressionToken: codec.sign(c),
    terminalAtBats: facts, status: 'active',
    createdAt: '2026-10-10T12:00:00Z', updatedAt: '2026-10-10T12:00:00Z', completedAt: null,
  };
  let resolved = response(c, 'correct');
  const repo = {
    getByKey: vi.fn(async () => row === null ? null : { ...row }),
    advance: vi.fn(async (expected: CustomNineAttemptState,
      action: { progressionToken: string; terminalAtBat?: DailyCompletedAtBat }) => {
      if (row === null || expected.revision !== row.revision
        || expected.currentProgressionToken !== row.currentProgressionToken
        || row.status !== 'active') return { status: 'conflict' as const };
      const nextFacts = [...row.terminalAtBats, ...(action.terminalAtBat ? [action.terminalAtBat] : [])];
      row = { ...row, revision: row.revision + 1, currentProgressionToken: action.progressionToken,
        terminalAtBats: nextFacts, status: nextFacts.length === 9 ? 'completed' : 'active',
        completedAt: nextFacts.length === 9 ? '2026-10-10T13:00:00Z' : null };
      return { status: 'advanced' as const, state: row };
    }),
  };
  const deps = {
    challengeExists: vi.fn(async () => true),
    getSecret: vi.fn(() => SECRET),
    repository: vi.fn(() => repo),
    resolve: vi.fn(async () => resolved as never),
  };
  return {
    repo, deps, service: createServerCustomNineTerminalResolutionService({ dependencies: deps }),
    setMode: (mode: 'correct' | 'strikeout' | 'give_up' | 'incorrect') => { resolved = response(c, mode); },
    setResponse: (x: unknown) => { resolved = x as typeof resolved; },
    setRow: (x: CustomNineAttemptState | null) => { row = x; },
    getRow: () => row,
  };
}
describe('private Custom Nine terminal CAS', () => {
  it('commits correct answer and returns no future hints or signed checkpoints', async () => {
    const s = setup();
    const answer = await s.service.resolve(ID, cookie, params(claims));
    expect(answer).toMatchObject({ kind: 'terminal', result: { kind: 'correct', outcome: 'HR' },
      revision: 1, hintBundle: { pitchNumber: 2, hints: [], checkpoints: [] } });
    expect(s.getRow()?.terminalAtBats).toEqual([{
      pitchNumber: 1, initials: 'P1', outcome: 'HR', hintsRevealed: 0, wrongGuesses: 0,
      resolution: 'correct',
    }]);
    expect(JSON.stringify(answer)).not.toContain('UNREVEALED_CLUE');
    expect(JSON.stringify(answer)).not.toContain('PRE_SIGNED_CHECKPOINT');
    expect(await s.service.resolve(ID, cookie, params(claims))).toEqual({ kind: 'conflict' });
  });
  it('persists third-strike K and explicit Give Up as distinct terminal facts', async () => {
    const third = { ...claims, strikeCount: 2 as const };
    const a = setup(third); a.setMode('strikeout');
    expect(await a.service.resolve(ID, cookie, params(third))).toMatchObject({ kind: 'terminal' });
    expect(a.getRow()?.terminalAtBats[0]).toMatchObject({
      outcome: 'K', wrongGuesses: 3, resolution: 'strikeout',
    });
    expect(codec.verify(a.getRow()!.currentProgressionToken)).toMatchObject({
      pitchNumber: 2, outCount: 1,
    });
    const giveup = { ...claims, strikeCount: 1 as const, revealCount: 2 as const };
    const b = setup(giveup); b.setMode('give_up');
    expect(await b.service.resolve(ID, cookie, params(giveup, true))).toMatchObject({ kind: 'terminal' });
    expect(b.getRow()?.terminalAtBats[0]).toMatchObject({
      outcome: 'K', wrongGuesses: 1, hintsRevealed: 2, resolution: 'give_up',
    });
  });
  it('completes exactly on the ninth terminal fact; any retry is immutable', async () => {
    const facts: DailyCompletedAtBat[] = Array.from({ length: 8 }, (_, index) => ({
      pitchNumber: index + 1, initials: 'P' + (index + 1), outcome: 'HR',
      hintsRevealed: 0, wrongGuesses: 0, resolution: 'correct',
    }));
    const c: DailyProgressionClaims = { ...claims, pitchNumber: 9 };
    const s = setup(c, facts);
    expect(await s.service.resolve(ID, cookie, params(c))).toMatchObject({
      kind: 'terminal', hintBundle: null,
    });
    expect(s.getRow()).toMatchObject({ revision: 9, status: 'completed', completedAt: expect.any(String) });
    expect(s.getRow()?.terminalAtBats).toHaveLength(9);
    expect(await s.service.resolve(ID, cookie, params(c))).toEqual({ kind: 'completed' });
  });
  it('returns one winning answer for simultaneous same-token resolutions', async () => {
    const s = setup();
    const results = await Promise.all([
      s.service.resolve(ID, cookie, params(claims)),
      s.service.resolve(ID, cookie, params(claims)),
    ]);
    expect(results.map(x => x.kind).sort()).toEqual(['conflict', 'terminal']);
    expect(s.repo.advance).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid/creator cookies, forged scope and lost attempt before resolve', async () => {
    const s = setup();
    const creator = createCustomNineCreatorBrowserMarker(SECRET)
      .creatorCookie(ID, 'https://example.test').split(';')[0]!;
    for (const c of [null, cookie + '; ' + cookie, creator]) {
      expect(await s.service.resolve(ID, c, params(claims))).toEqual({ kind: 'invalid_credential' });
    }
    expect(await s.service.resolve(ID, cookie, { progressionToken: codec.sign({ ...claims, puzzleId: OTHER }), giveUp: true }))
      .toEqual({ kind: 'invalid_progression' });
    s.deps.challengeExists.mockResolvedValueOnce(false);
    expect(await s.service.resolve(OTHER, null, params(claims))).toEqual({ kind: 'not_found' });
    s.setRow(null);
    expect(await s.service.resolve(ID, cookie, params(claims))).toEqual({ kind: 'invalid_credential' });
    expect(s.repo.advance).not.toHaveBeenCalled();
  });
  it('refuses nonterminal guessing oracle and invalid signed receipt/successor before write', async () => {
    for (const alter of [
      () => response(claims, 'incorrect'),
      () => ({ ...response(claims, 'correct'), terminalReceipt: 'forged' }),
      () => ({ ...response(claims, 'correct'), progressionToken: codec.sign(claims) }),
      () => ({ ...response(claims, 'correct'), hintBundle: nextBundle(3) }),
      () => ({ ...response(claims, 'correct'), result: {
        ...response(claims, 'correct').result, outcome: '1B',
      } }),
    ]) {
      const s = setup(); s.setResponse(alter());
      await expect(s.service.resolve(ID, cookie, params(claims)))
        .rejects.toThrow('Invalid authoritative Custom Nine terminal transition');
      expect(s.repo.advance).not.toHaveBeenCalled();
    }
  });
  it('losing CAS never returns the answer, receipt or successor', async () => {
    const s = setup(); s.repo.advance.mockResolvedValueOnce({ status: 'conflict' } as never);
    expect(await s.service.resolve(ID, cookie, params(claims))).toEqual({ kind: 'conflict' });
  });
});
