import { describe, expect, it, vi } from 'vitest';
import { createOfficialDailyCompetitiveProofCodec } from './officialDailyCompetitiveProof';
import { A, ATTEMPT, DATE, SECRET, tokens } from './officialDailyCompetitive.testFixtures';

vi.mock('server-only', () => ({}));

const NEXT = 'new-official-competitive-secret-0123456789abcdef';
const validProof = {
  version: 1 as const, purpose: 'live' as const, attemptId: ATTEMPT,
  puzzleId: A, puzzleDate: DATE, rulesetVersion: 'points-v4' as const,
  startedAt: Date.parse(DATE + 'T12:00:00Z'),
  progressionToken: tokens.sign({ version: 1, rulesetVersion: 'points-v4', puzzleId: A,
    puzzleDate: DATE, pitchNumber: 1, revealCount: 0, strikeCount: 0, outCount: 0,
    completed: false }),
  atBats: [],
};

describe('competitive signed proof rotation', () => {
  it('verifies a legacy proof but signs new proof only with the active secret', () => {
    const old = createOfficialDailyCompetitiveProofCodec(SECRET);
    const rotated = createOfficialDailyCompetitiveProofCodec(NEXT, [SECRET]);
    const oldToken = old.sign(validProof);
    expect(rotated.verify(oldToken)).toEqual(validProof);
    const newToken = rotated.sign(validProof);
    expect(createOfficialDailyCompetitiveProofCodec(NEXT).verify(newToken)).toEqual(validProof);
    expect(() => old.verify(newToken)).toThrow();
    expect(() => createOfficialDailyCompetitiveProofCodec(NEXT).verify(oldToken)).toThrow();
    expect(() => rotated.verify(oldToken + 'tampered')).toThrow();
  });

  it('refuses weak verification secrets rather than accepting an unusable ring', () => {
    expect(() => createOfficialDailyCompetitiveProofCodec(NEXT, ['short'])).toThrow();
  });
});
