import { describe, expect, it, vi } from 'vitest';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createOfficialDailyCompetitiveProofCodec } from './officialDailyCompetitiveProof';
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
  startedAt = START,
  signing: { secret: string; legacyVerificationSecrets?: readonly string[] } = { secret: SECRET },
) {
  const reservation = {
    attemptId, puzzleId: id, puzzleDate: DATE, rulesetVersion: 'points-v4' as const,
    browserKeyDigest: 'a'.repeat(64), startedAt,
  };
  const producer = runtime(id, clock, { attemptId, startedAt }, signing);
  const signedTokens = createDailyProgressionTokenCodec(
    signing.secret, 9, signing.legacyVerificationSecrets,
  );
  const reserveAttempt = vi.fn(async () => reservation);
  const game = createOfficialDailyCompetitiveCASRuntime({
    puzzleId: id, runtime: producer, progressionTokens: signedTokens, secret: signing.secret,
    ...(signing.legacyVerificationSecrets === undefined ? {} : {
      legacyVerificationSecrets: signing.legacyVerificationSecrets,
    }),
    reserveAttempt, progression: database, completion: database, now: () => clock,
  });
  return { game, database, reserveAttempt, reservation };
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

  it('starts from the archive and resumes the same at-bat days later', async () => {
    const start = new Date('2026-11-09T12:00:00Z');
    const first = rig(A, start, memory(), ATTEMPT, start.toISOString());
    const boot = await first.game.getBootstrap(DATE);
    const play = await first.game.resolveAtBat({ progressionToken: boot.progressionToken, giveUp: true });
    const returning = rig(A, new Date('2026-11-15T12:00:00Z'), first.database, ATTEMPT, start.toISOString());
    const resumed = await returning.game.getBootstrap(DATE);
    expect(resumed.progressionToken).toBe(play.progressionToken);
    expect(resumed.hintBundle.pitchNumber).toBe(2);
    expect((await returning.game.readScorecard(first.reservation)).revision).toBe(1);
    await returning.game.resolveAtBat({ progressionToken: resumed.progressionToken, giveUp: true });
    expect(first.database.state()?.revision).toBe(2);
  });

  it('restores a previously signed exact-edition attempt after a controlled key change', async () => {
    const base = rig();
    const oldStart = await base.game.getBootstrap(DATE);
    const first = await base.game.resolveAtBat({ progressionToken: oldStart.progressionToken, giveUp: true });
    const changedSecret = 'new-official-daily-competitive-key-0123456789abcdef';
    const revoked = rig(A, new Date(START), base.database, ATTEMPT, START,
      { secret: changedSecret });
    await expect(revoked.game.getBootstrap(DATE)).rejects.toThrow();

    const rotated = rig(A, new Date(START), base.database, ATTEMPT, START, {
      secret: changedSecret, legacyVerificationSecrets: [SECRET],
    });
    // Old response-loss retries can produce a newly signed successor whose
    // bytes differ from the already persisted winner. Fail closed rather than
    // admitting a second result; authoritative bootstrap remains recoverable.
    await expect(rotated.game.resolveAtBat({
      progressionToken: oldStart.progressionToken, giveUp: true,
    })).rejects.toThrow();
    expect(base.database.state()).toMatchObject({
      revision: 1, token: first.progressionToken,
    });
    const restored = await rotated.game.getBootstrap(DATE);
    expect(restored.progressionToken).toBe(first.progressionToken);
    expect(restored.hintBundle.pitchNumber).toBe(2);
    const card = await rotated.game.readScorecard(base.reservation);
    expect(card).toMatchObject({ status: 'active', revision: 1 });
    const advanced = await rotated.game.resolveAtBat({
      progressionToken: restored.progressionToken, giveUp: true,
    });
    const newProofs = createOfficialDailyCompetitiveProofCodec(changedSecret);
    const newTokens = createDailyProgressionTokenCodec(changedSecret);
    const reissued = newProofs.verify(advanced.progressionToken);
    expect(newTokens.verify(reissued.progressionToken).pitchNumber).toBe(3);
    expect(() => proofs.verify(advanced.progressionToken)).toThrow();
    expect(base.database.state()?.revision).toBe(2);
    expect((await rotated.game.readScorecard(base.reservation)).atBats).toHaveLength(2);
  });

  it('fails closed on old-key wrong-guess replay or conflicting stale give-up and restores the winner', async () => {
    const base = rig();
    const started = await base.game.getBootstrap(DATE);
    const wrong = await base.game.resolveAtBat({
      progressionToken: started.progressionToken, submittedPlayerId: OTHER,
    });
    const changedSecret = 'new-official-daily-competitive-key-0123456789abcdef';
    const rotated = rig(A, new Date(START), base.database, ATTEMPT, START, {
      secret: changedSecret, legacyVerificationSecrets: [SECRET],
    });
    await expect(rotated.game.resolveAtBat({
      progressionToken: started.progressionToken, submittedPlayerId: OTHER,
    })).rejects.toThrow();
    await expect(rotated.game.resolveAtBat({
      progressionToken: started.progressionToken, giveUp: true,
    })).rejects.toThrow();
    expect(base.database.state()).toMatchObject({
      token: wrong.progressionToken, revision: 1, terminalAtBats: [],
    });
    const card = await rotated.game.readScorecard(base.reservation);
    expect(card).toMatchObject({ status: 'active', revision: 1, strikeCount: 1 });
    const resumed = await rotated.game.resolveAtBat({
      progressionToken: wrong.progressionToken, giveUp: true,
    });
    expect(base.database.state()).toMatchObject({
      token: resumed.progressionToken, revision: 2,
      terminalAtBats: [{ pitchNumber: 1, resolution: 'give_up' }],
    });
  });

  it('restores a completed old-key scorecard after a lost final response without duplicating results', async () => {
    const base = rig();
    let token = (await base.game.getBootstrap(DATE)).progressionToken;
    for (let i = 0; i < 8; i++) {
      token = (await base.game.resolveAtBat({ progressionToken: token, giveUp: true })).progressionToken;
    }
    const finalRequest = { progressionToken: token, giveUp: true };
    const finished = await base.game.resolveAtBat(finalRequest);
    const changedSecret = 'new-official-daily-competitive-key-0123456789abcdef';
    const rotated = rig(A, new Date(START), base.database, ATTEMPT, START, {
      secret: changedSecret, legacyVerificationSecrets: [SECRET],
    });
    await expect(rotated.game.resolveAtBat(finalRequest)).rejects.toThrow();
    expect(base.database.state()).toMatchObject({
      token: finished.progressionToken, status: 'completed', revision: 9,
    });
    const card = await rotated.game.readScorecard(base.reservation);
    expect(card).toMatchObject({ status: 'completed', revision: 9 });
    expect(card.atBats).toHaveLength(9);
    expect(base.database.advanceAndCommit).toHaveBeenCalledTimes(1);
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
    const clock = new Date('2026-11-09T12:00:00Z');
    const { game, database, reservation } = rig(A, clock, memory(), ATTEMPT, clock.toISOString());
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
    clock.setUTCDate(clock.getUTCDate() + 10);
    const card = await game.readScorecard(reservation);
    expect(card).toMatchObject({ status: 'completed', revision: 9, summary: { points: 0 } });
    expect(card.atBats).toHaveLength(9);
    expect(card).not.toHaveProperty('progressionToken');
    expect(card).not.toHaveProperty('hintBundle');
    expect(database.state()).toBe(state);
    await expect(game.getHintBundle(current)).rejects.toThrow();
    await expect(game.getBootstrap(DATE)).rejects.toThrow();
  });

  it('rejects mismatched browser reservation, tampered SQL winner and pre-bootstrap actions', async () => {
    const clock = new Date(START);
    const x = rig(A, clock);
    const token = (await x.game.getBootstrap(DATE)).progressionToken;
    const wrong = createOfficialDailyCompetitiveCASRuntime({
      puzzleId: A, runtime: runtime(A), progressionTokens: tokens, secret: SECRET,
      reserveAttempt: async () => ({ ...x.reservation, attemptId: OTHER_ATTEMPT }),
      progression: memory(), completion: memory(), now: () => new Date(START),
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
