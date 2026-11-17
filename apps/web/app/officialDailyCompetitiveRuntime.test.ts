import { describe, expect, it, vi } from 'vitest';
import { A, B, DATE, ANSWER, OTHER, runtime, tokens, proofs } from './officialDailyCompetitive.testFixtures';
vi.mock('server-only', () => ({}));

describe('source-only competitive Daily transcript', () => {
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

  it('does not issue a live attempt for an archived or future date', async () => {
    await expect(runtime(A, new Date('2026-11-07T12:00:00Z')).getBootstrap(DATE)).rejects.toThrow();
    await expect(runtime(A, new Date('2026-11-05T12:00:00Z')).getBootstrap(DATE)).rejects.toThrow();
  });

  it('does not confuse a legacy progression token with a competitive proof', async () => {
    const boot = await runtime(A).getBootstrap(DATE);
    const inner = proofs.verify(boot.progressionToken).progressionToken;
    await expect(runtime(A).getHintBundle(inner)).rejects.toThrow();
    expect(() => tokens.verify(boot.progressionToken)).toThrow();
  });
});
