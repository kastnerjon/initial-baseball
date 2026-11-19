import { describe, expect, it, vi } from 'vitest';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { OfficialDailyProgressionSnapshot } from './supabaseOfficialDailyProgressionStore';
import { createOfficialDailyCompetitiveCASRuntime } from './officialDailyCompetitiveCASRuntime';
import { A, B, DATE, ANSWER, OTHER, ATTEMPT, SECRET, runtime, tokens, proofs } from './officialDailyCompetitive.testFixtures';
vi.mock('server-only', () => ({}));

const OTHER_ATTEMPT = 'acfa597c-c32a-4d52-8e33-7fa70127cc7f';
const START = '2026-11-06T12:00:00.000Z';

function sameFacts(a: DailyCompletedAtBat[], b: DailyCompletedAtBat[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function memory() {
  let winner: OfficialDailyProgressionSnapshot | null = null;
  const initialize = vi.fn(async (_reservation: unknown, token: string) => {
    if (!winner) {
      winner = { token, revision: 0, terminalAtBats: [], status: 'active' };
      return { outcome: 'initialized' as const, state: winner };
    }
    return { outcome: 'existing' as const, state: winner };
  });
  const read = vi.fn(async () => {
    if (!winner) throw new Error('not initialized');
    return winner;
  });
  const advance = vi.fn(async (input: {
    expectedToken: string; nextToken: string; terminalAtBats: DailyCompletedAtBat[]; completed: boolean;
  }) => {
    if (!winner) throw new Error('not initialized');
    if (winner.token === input.nextToken && sameFacts(winner.terminalAtBats, input.terminalAtBats)) {
      return { outcome: 'existing' as const, state: winner };
    }
    if (winner.token !== input.expectedToken || winner.status === 'completed') {
      return { outcome: 'conflict' as const, state: winner };
    }
    if (input.terminalAtBats.length < winner.terminalAtBats.length ||
      input.terminalAtBats.length > winner.terminalAtBats.length + 1 ||
      input.terminalAtBats.some((fact, i) => i < winner!.terminalAtBats.length &&
        JSON.stringify(fact) !== JSON.stringify(winner!.terminalAtBats[i]))) {
      throw new Error('nonmonotonic');
    }
    winner = {
      token: input.nextToken, revision: winner.revision + 1,
      terminalAtBats: input.terminalAtBats, status: input.completed ? 'completed' : 'active',
    };
    return { outcome: 'advanced' as const, state: winner };
  });
  type CompletionStore = Parameters<typeof createOfficialDailyCompetitiveCASRuntime>[0]['completion'];
  const advanceAndCommit = vi.fn<CompletionStore['advanceAndCommit']>(async input => {
    const result = await advance({ ...input, completed: true });
    if (result.outcome === 'conflict') throw new Error('conflict');
    return result.outcome === 'existing' ? 'existing' : 'created';
  });
  return { initialize, read, advance, advanceAndCommit, state: () => winner, set: (state: OfficialDailyProgressionSnapshot) => { winner = state; } };
}

function rig(
  id = A,
  clock = new Date(START),
  database = memory(),
  attemptId = id === A ? ATTEMPT : OTHER_ATTEMPT,
) {
  const reservation = {
    attemptId, puzzleId: id, puzzleDate: DATE, rulesetVersion: 'points-v4' as const,
    browserKeyDigest: 'a'.repeat(64), startedAt: START,
  };
  const readExistingAttempt = vi.fn(async () => {
    if (!database.state()) throw new Error('No existing reservation');
    return reservation;
  });
  const producer = runtime(id, clock, { attemptId }, readExistingAttempt);
  const reserveAttempt = vi.fn(async () => reservation);
  const game = createOfficialDailyCompetitiveCASRuntime({
    puzzleId: id, runtime: producer, progressionTokens: tokens, secret: SECRET,
    reserveAttempt, progression: database, completion: database, now: () => clock,
    maximumAttemptAgeMs: 24 * 60 * 60 * 1000,
  });
  return { game, database, reserveAttempt, readExistingAttempt, reservation };
}

describe('source-only durable official Daily competitive CAS runtime', () => {
  it('keeps four instant current-batter hints and initializes the same first-start winner on retries', async () => {
    const { game, database, reserveAttempt } = rig();
    const first = await game.getBootstrap(DATE);
    expect(first.hintBundle.hints).toHaveLength(4);
    expect(first.hintBundle.checkpoints).toHaveLength(4);
    expect(JSON.stringify(first)).not.toContain('FUTURE HINT');
    expect(JSON.stringify(first)).not.toContain(ANSWER);
    const second = await game.getBootstrap(DATE);
    expect(second.progressionToken).toBe(first.progressionToken);
    expect(database.state()).toMatchObject({ token: first.progressionToken, revision: 0, status: 'active' });
    expect(database.initialize).toHaveBeenCalledTimes(2);
    expect(reserveAttempt).toHaveBeenCalledWith({ puzzleId: A, puzzleDate: DATE, rulesetVersion: 'points-v4' });
  });

  it('authorizes local hint checkpoints without CAS writes, then atomically advances the guess', async () => {
    const { game, database } = rig();
    const bootstrap = await game.getBootstrap(DATE);
    const checkpoint = bootstrap.hintBundle.checkpoints[1]!;
    const bundle = await game.getHintBundle(checkpoint.progressionToken);
    expect(bundle.hintBundle.revealedCount).toBe(2);
    expect(bundle.hintBundle.hints).toHaveLength(4);
    expect(database.advance).not.toHaveBeenCalled();
    expect(database.state()?.revision).toBe(0);
    const wrong = await game.resolveAtBat({ progressionToken: checkpoint.progressionToken, submittedPlayerId: OTHER });
    const signed = proofs.verify(wrong.progressionToken);
    expect(tokens.verify(signed.progressionToken)).toMatchObject({ pitchNumber: 1, revealCount: 2, strikeCount: 1 });
    expect(database.state()).toMatchObject({ token: wrong.progressionToken, revision: 1 });
    await expect(game.resolveAtBat({
      progressionToken: bootstrap.hintBundle.checkpoints[0]!.progressionToken,
      giveUp: true,
    })).rejects.toThrow();
    expect(database.state()?.revision).toBe(1);
  });

  it('restores the stored current batter and hints rather than resetting the signed attempt', async () => {
    const { game, database, reservation } = rig();
    const bootstrap = await game.getBootstrap(DATE);
    const terminal = await game.resolveAtBat({ progressionToken: bootstrap.progressionToken, giveUp: true });
    const resumed = await game.getBootstrap(DATE);
    const card = await game.readScorecard(reservation);
    expect(card).toMatchObject({ status: 'active', revision: 1,
      atBats: [{ pitchNumber: 1, resolution: 'give_up' }],
      progressionToken: terminal.progressionToken, hintBundle: { pitchNumber: 2 } });
    expect(resumed.progressionToken).toBe(terminal.progressionToken);
    expect(resumed.hintBundle.pitchNumber).toBe(2);
    expect(resumed.hintBundle.hints).toHaveLength(4);
    expect(database.state()?.revision).toBe(1);
  });

  it('recovers the current batter after Pacific midnight only for an existing unexpired start', async () => {
    const first = rig();
    const boot = await first.game.getBootstrap(DATE);
    const play = await first.game.resolveAtBat({ progressionToken: boot.progressionToken, giveUp: true });
    const midnight = new Date('2026-11-07T08:00:01Z');
    const returning = rig(A, midnight, first.database);
    const resumed = await returning.game.getBootstrap(DATE);
    expect(resumed.progressionToken).toBe(play.progressionToken);
    expect(resumed.hintBundle.pitchNumber).toBe(2);
    expect(returning.readExistingAttempt).toHaveBeenCalledOnce();
    expect(first.database.state()?.revision).toBe(1);
    const fresh = rig(A, midnight);
    await expect(fresh.game.getBootstrap(DATE)).rejects.toThrow();
    expect(fresh.database.initialize).not.toHaveBeenCalled();
    const expired = rig(A, new Date('2026-11-07T12:00:01Z'), first.database);
    await expect(expired.game.getBootstrap(DATE)).rejects.toThrow();
  });

  it('treats the identical response-loss replay as idempotent, without increasing revision', async () => {
    const { game, database } = rig();
    const original = await game.getBootstrap(DATE);
    const request = { progressionToken: original.progressionToken, giveUp: true };
    const first = await game.resolveAtBat(request);
    const again = await game.resolveAtBat(request);
    expect(again).toEqual(first);
    expect(database.state()?.revision).toBe(1);
    expect(database.advance).toHaveBeenCalledTimes(2);
  });

  it('serializes conflicting signed guesses and give-ups, without leaking losing response', async () => {
    const { game, database } = rig();
    const start = await game.getBootstrap(DATE);
    const results = await Promise.allSettled([
      game.resolveAtBat({ progressionToken: start.progressionToken, giveUp: true }),
      game.resolveAtBat({ progressionToken: start.progressionToken, submittedPlayerId: ANSWER }),
    ]);
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(x => x.status === 'rejected')).toHaveLength(1);
    expect(database.state()?.revision).toBe(1);
    expect(database.state()?.terminalAtBats).toHaveLength(1);
  });

  it('keeps two identical-roster sibling editions strictly independent', async () => {
    const one = rig(A), two = rig(B);
    const first = await one.game.getBootstrap(DATE);
    const second = await two.game.getBootstrap(DATE);
    expect(proofs.verify(first.progressionToken).puzzleId).toBe(A);
    expect(proofs.verify(second.progressionToken).puzzleId).toBe(B);
    await expect(two.game.resolveAtBat({ progressionToken: first.progressionToken, giveUp: true }))
      .rejects.toThrow();
    await expect(two.game.readScorecard(one.reservation)).rejects.toThrow();
    expect(two.database.state()?.revision).toBe(0);
    expect(one.database.state()?.revision).toBe(0);
  });

  it('completes exactly nine ordered terminal facts with one authoritative revision each', async () => {
    const { game, database, reservation } = rig();
    let current = (await game.getBootstrap(DATE)).progressionToken;
    for (let i = 0; i < 8; i++) {
      current = (await game.resolveAtBat({ progressionToken: current, giveUp: true })).progressionToken;
    }
    const last = { progressionToken: current, giveUp: true };
    database.advanceAndCommit.mockRejectedValueOnce(new Error('write failed'));
    await expect(game.resolveAtBat(last)).rejects.toThrow();
    expect(database.state()?.revision).toBe(8);
    current = (await game.resolveAtBat(last)).progressionToken;
    expect((await game.resolveAtBat(last)).progressionToken).toBe(current);
    expect(database.advanceAndCommit.mock.lastCall?.[0]).toMatchObject({
      reservation: { puzzleId: A, attemptId: ATTEMPT },
      completion: { submissionId: `official-${A}-${ATTEMPT}`, summary: { points: 0 } },
    });
    expect(database.advanceAndCommit.mock.lastCall?.[0].atBats).toHaveLength(9);
    const state = database.state()!;
    expect(state).toMatchObject({ status: 'completed', revision: 9, token: current });
    expect(state.terminalAtBats.map(x => x.pitchNumber)).toEqual([1,2,3,4,5,6,7,8,9]);
    const card = await game.readScorecard(reservation);
    expect(card).toMatchObject({ status: 'completed', revision: 9, summary: { points: 0 } });
    expect(card.atBats).toHaveLength(9);
    expect(card).not.toHaveProperty('progressionToken');
    expect(card).not.toHaveProperty('hintBundle');
    expect(database.state()).toBe(state);
    await expect(game.getHintBundle(current)).rejects.toThrow();
    await expect(game.getBootstrap(DATE)).rejects.toThrow();
  });

  it('rejects expired tokens, mismatched browser reservation, tampered SQL winner and pre-bootstrap actions', async () => {
    const clock = new Date(START);
    const x = rig(A, clock);
    const token = (await x.game.getBootstrap(DATE)).progressionToken;
    clock.setTime(clock.getTime() + 2 * 24 * 60 * 60 * 1000);
    await expect(x.game.getHintBundle(token)).rejects.toThrow();
    await expect(x.game.readScorecard(x.reservation)).rejects.toThrow();
    const wrong = createOfficialDailyCompetitiveCASRuntime({
      puzzleId: A, runtime: runtime(A), progressionTokens: tokens, secret: SECRET,
      reserveAttempt: async () => ({ ...x.reservation, attemptId: OTHER_ATTEMPT }),
      progression: memory(), completion: memory(), now: () => new Date(START), maximumAttemptAgeMs: 86_400_000,
    });
    await expect(wrong.getBootstrap(DATE)).rejects.toThrow();
    const fresh = rig();
    await expect(fresh.game.resolveAtBat({ progressionToken: token, giveUp: true })).rejects.toThrow();
    const boot = await fresh.game.getBootstrap(DATE);
    fresh.database.set({ ...fresh.database.state()!, token: 'official-daily-competitive-proof-v1.fake.sig' });
    await expect(fresh.game.getHintBundle(boot.progressionToken)).rejects.toThrow();
    await expect(fresh.game.readScorecard(fresh.reservation)).rejects.toThrow();
  });
});
