import { describe, expect, it, vi } from 'vitest';
import { A, B, DATE, ANSWER, OTHER, ATTEMPT, SECRET, runtime, tokens, proofs } from './officialDailyCompetitive.testFixtures';
import { createOfficialDailyCompetitiveAdmission } from './officialDailyCompetitiveAdmission';
vi.mock('server-only', () => ({}));

describe('source-only competitive Daily transcript', () => {
  it('binds repeated live bootstraps to one durable reservation identity', async () => {
    const appClock = new Date('2026-11-06T12:05:00.000Z');
    const game = runtime(A, appClock);
    const first = proofs.verify((await game.getBootstrap(DATE)).progressionToken);
    appClock.setTime(Date.parse('2026-11-06T12:07:00.000Z'));
    const second = proofs.verify((await game.getBootstrap(DATE)).progressionToken);
    expect(second).toEqual(first);
    expect(first.attemptId).toBe(ATTEMPT);
    expect(first.startedAt).toBe(Date.parse('2026-11-06T12:00:00.000Z'));
  });

  it('admits source-signed terminal facts with a 30-second DB lead and zero-skew control', async () => {
    for (const secondsAhead of [0, 30]) {
      const clock = new Date('2026-11-06T12:00:00.000Z');
      const game = runtime(A, clock, {
        startedAt: new Date(clock.getTime() + secondsAhead * 1000).toISOString(),
      });
      const bootstrap = await game.getBootstrap(DATE);
      const terminal = await game.resolveAtBat({
        progressionToken: bootstrap.progressionToken, giveUp: true,
      });
      const stored = [] as string[];
      const service = createOfficialDailyCompetitiveAdmission({
        secret: SECRET, progressionTokens: tokens,
        loadReleasedPuzzle: () => game.getPublicPuzzle(DATE),
        now: () => clock, maximumAttemptAgeMs: 24 * 60 * 60 * 1000,
        atBats: { async insertIfAbsent(result) {
          stored.push(result.attemptId);
          return { status: 'inserted', result };
        } },
        completions: { async insertIfAbsent(result) {
          return { status: 'inserted', result };
        } },
      });
      await expect(service.submit(terminal.progressionToken, A)).resolves.toEqual({
        ok: true, status: 'created', completed: false,
      });
      expect(stored).toEqual([ATTEMPT]);
      expect(proofs.verify(terminal.progressionToken).startedAt).toBe(
        Date.parse('2026-11-06T12:00:00.000Z') + secondsAhead * 1000,
      );
    }
  });

  it('fails closed on a mismatched edition, date or start window from reservation', async () => {
    const now = new Date('2026-11-06T12:00:00Z');
    for (const override of [
      { puzzleId: B }, { puzzleDate: '2026-11-05' },
      { startedAt: '2026-11-05T12:00:00.000Z' },
      { startedAt: '2026-11-06T13:01:00.000Z' },
      { startedAt: 'malformed' },
    ]) {
      await expect(runtime(A, now, override).getBootstrap(DATE)).rejects.toThrow();
    }
  });

  it('records server-observed hints, wrong guesses and terminal outcomes through nine batters', async () => {
    const game = runtime(A);
    const boot = await game.getBootstrap(DATE);
    expect(boot.hintBundle.hints).toHaveLength(4);
    expect(JSON.stringify(boot)).not.toContain('FUTURE HINT');
    expect(JSON.stringify(boot)).not.toContain(ANSWER);
    const hint = boot.hintBundle.checkpoints[0]!;
    const wrong = await game.resolveAtBat({ progressionToken: hint.progressionToken, submittedPlayerId: OTHER });
    expect(proofs.verify(wrong.progressionToken).atBats).toEqual([]);
    const hit = await game.resolveAtBat({ progressionToken: wrong.progressionToken, submittedPlayerId: ANSWER });
    expect(proofs.verify(hit.progressionToken).atBats).toEqual([
      { pitchNumber: 1, initials: 'HP', outcome: '3B', hintsRevealed: 1, wrongGuesses: 1, resolution: 'correct' },
    ]);
    let token = hit.progressionToken;
    for (let i = 2; i <= 9; i++) token = (await game.resolveAtBat({ progressionToken: token, giveUp: true })).progressionToken;
    const completed = proofs.verify(token);
    expect(completed.atBats).toHaveLength(9);
    expect(completed.atBats[8]).toMatchObject({ pitchNumber: 9, outcome: 'K', resolution: 'give_up' });
    expect(tokens.verify(completed.progressionToken).completed).toBe(true);
  });

  it('rejects sibling edition tokens even with identical players and rejects tampered proof', async () => {
    const first = await runtime(A).getBootstrap(DATE);
    await expect(runtime(B).getHintBundle(first.progressionToken)).rejects.toThrow();
    const parts = first.progressionToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
    payload.puzzleId = B;
    const edited = `${parts[0]}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${parts[2]}`;
    expect(() => proofs.verify(edited)).toThrow();
  });

  it('rejects facts edited after the server signs them', async () => {
    const game = runtime(A);
    const boot = await game.getBootstrap(DATE);
    const finished = await game.resolveAtBat({ progressionToken: boot.progressionToken, giveUp: true });
    const parts = finished.progressionToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
    payload.atBats[0].outcome = 'HR';
    const edited = `${parts[0]}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${parts[2]}`;
    await expect(game.getHintBundle(edited)).rejects.toThrow();
  });

  it('documents why an atomic admission gate is still mandatory', async () => {
    const game = runtime(A);
    const boot = await game.getBootstrap(DATE);
    const hit = await game.resolveAtBat({ progressionToken: boot.progressionToken, submittedPlayerId: ANSWER });
    const giveUp = await game.resolveAtBat({ progressionToken: boot.progressionToken, giveUp: true });
    const first = proofs.verify(hit.progressionToken);
    const fork = proofs.verify(giveUp.progressionToken);
    expect(first.attemptId).toBe(fork.attemptId);
    expect(first.atBats[0]?.outcome).toBe('HR');
    expect(fork.atBats[0]?.outcome).toBe('K');
  });

  it('starts released archives and rejects future editions', async () => {
    const later = new Date('2026-11-09T12:00:00Z');
    const archive = runtime(A, later, { startedAt: later.toISOString() });
    const boot = await archive.getBootstrap(DATE);
    expect(proofs.verify(boot.progressionToken)).toMatchObject({ puzzleDate: DATE, startedAt: later.getTime() });
    await expect(runtime(A, new Date('2026-11-05T12:00:00Z')).getBootstrap(DATE)).rejects.toThrow();
  });

  it('does not confuse a legacy progression token with a competitive proof', async () => {
    const boot = await runtime(A).getBootstrap(DATE);
    const inner = proofs.verify(boot.progressionToken).progressionToken;
    await expect(runtime(A).getHintBundle(inner)).rejects.toThrow();
    expect(() => tokens.verify(boot.progressionToken)).toThrow();
  });
});
