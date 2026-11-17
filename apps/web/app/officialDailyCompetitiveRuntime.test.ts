import { describe, expect, it, vi } from 'vitest';
import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import { DEFAULT_DAILY_HINT_CONFIG, DEFAULT_DAILY_STATS_HINT_CONFIG, type DailyPuzzle } from '@initial-baseball/shared';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createDailyRuntimeService } from './dailyRuntimeService';
import { createOfficialDailyCompetitiveProofCodec } from './officialDailyCompetitiveProof';
import { createOfficialDailyCompetitiveRuntime } from './officialDailyCompetitiveRuntime';

vi.mock('server-only', () => ({}));

const DATE = '2026-11-06';
const A = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const B = 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591';
const ATTEMPT = '3f3adba3-1405-4ffd-9cb9-082146a47814';
const SECRET = 'official-competitive-test-secret-0123456789';
const ANSWER = 'ibp_ab000000000000000000';
const OTHER = 'ibp_cd000000000000000000';
const tokens = createDailyProgressionTokenCodec(SECRET);
const proofs = createOfficialDailyCompetitiveProofCodec(SECRET);

function runtime(id: string, now = new Date('2026-11-06T12:00:00Z')) {
  const puzzle: DailyPuzzle = {
    id, puzzleDate: DATE, puzzleNumber: 194, status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG, statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: Array.from({ length: 9 }, (_, i) => ({ pitchNumber: i + 1,
      player: { playerId: ANSWER, fullName: 'Hidden Player', displayName: 'Hidden Player',
        initials: 'HP', kind: 'hitter' as const, primaryPosition: 'CF' },
      hints: { main_decade: i === 0 ? 'FIRST HINT' : 'FUTURE HINT', teams: 'NYM', position: 'CF', stats: '3 HR' },
    })),
  };
  const reveal = { playerId: ANSWER, displayName: 'Hidden Player', playerType: 'hitter',
    career: { primaryPosition: 'CF', firstSeason: 2000, lastSeason: 2001, teamIds: [],
      batting: null, pitching: null, advanced: null }, seasons: [] } as unknown as CanonicalPlayerReveal;
  const base = createDailyRuntimeService({ createPuzzle: () => puzzle, progressionTokens: tokens,
    resolveLegacyPlayerId: id => id, getCanonicalReveal: () => reveal });
  return createOfficialDailyCompetitiveRuntime({ puzzleId: id, runtime: base, progressionTokens: tokens,
    secret: SECRET, now: () => now, newAttemptId: () => ATTEMPT });
}

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
