import { describe, expect, it, vi } from 'vitest';
import { createCustomLineupIssuedChallenge, createCustomLineupIssuedClueSnapshot } from '@initial-baseball/daily';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
vi.mock('server-only', () => ({}));

import { createCustomLineupV2AttemptBrowserCredential, createCustomNineAttemptBrowserCredential }
  from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { createCustomLineupV2ProgressionTokens } from './serverCustomLineupV2Bootstrap';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerCustomLineupV2CompletedAdmissionService }
  from './serverCustomLineupV2CompletedAdmission';
import type { CustomLineupV2AdmissionInput } from './supabaseCustomLineupV2AdmissionRepository';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174001';
const V1 = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const ATTEMPT = '123e4567-e89b-42d3-a456-426614174010';
const SECRET = 'custom-lineup-v2-private-admission-test-secret-strong-enough';
const TOKENS = createCustomLineupV2ProgressionTokens(SECRET);
const BROWSER = createCustomLineupV2AttemptBrowserCredential(SECRET).issue(ID, 'https://example.test');
const COOKIE = BROWSER.setCookie.split(';')[0]!;
const CREATOR = createCustomLineupV2CreatorBrowserMarker(SECRET)
  .creatorCookie(ID, 'https://example.test').split(';')[0]!;
const IDS = Array.from({ length: 10 }, (_, i) => 'ibp_' + (i + 1).toString(16).padStart(20, '0'));

function challenge(n: number) {
  return createCustomLineupIssuedChallenge({
    puzzleId: ID, issuedAt: '2026-10-15T12:00:00Z',
    canonicalPlayerIds: IDS.slice(0, n),
    clueSnapshot: createCustomLineupIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: IDS.slice(0, n).map((canonicalPlayerId, i) => ({
        pitchNumber: i + 1, canonicalPlayerId, initials: 'P' + (i + 1),
        hintValues: ['PRIVATE_DECADE', 'PRIVATE_TEAMS', 'PRIVATE_POSITION', 'PRIVATE_STATS'],
      })),
    }),
  });
}
function facts(n: number): DailyCompletedAtBat[] {
  return Array.from({ length: n }, (_, i): DailyCompletedAtBat => {
    if (i === 1) return { pitchNumber: i + 1, initials: 'P' + (i + 1),
      hintsRevealed: 4, wrongGuesses: 0, outcome: 'BB', resolution: 'correct' };
    if (i === 2) return { pitchNumber: i + 1, initials: 'P' + (i + 1),
      hintsRevealed: 0, wrongGuesses: 3, outcome: 'K', resolution: 'strikeout' };
    if (i === 3) return { pitchNumber: i + 1, initials: 'P' + (i + 1),
      hintsRevealed: 1, wrongGuesses: 1, outcome: 'K', resolution: 'give_up' };
    return { pitchNumber: i + 1, initials: 'P' + (i + 1),
      hintsRevealed: 0, wrongGuesses: 0, outcome: 'HR', resolution: 'correct' };
  });
}
function state(n: number): CustomNineAttemptState {
  const completedAtBats = facts(n);
  const strikeouts = completedAtBats.filter(f => f.outcome === 'K').length;
  const revision = completedAtBats.reduce((sum, f) => sum + 1 + f.hintsRevealed
    + (f.resolution === 'strikeout' ? 2 : f.wrongGuesses), 0);
  return {
    challengeId: ID, browserKeyDigest: BROWSER.browserKeyDigest, attemptId: ATTEMPT,
    revision, terminalAtBats: completedAtBats,
    currentProgressionToken: TOKENS.sign({
      version: 1, rulesetVersion: 'points-v4', puzzleId: ID,
      puzzleDate: CUSTOM_NINE_SESSION_DATE, pitchNumber: n,
      revealCount: 0, strikeCount: 0, outCount: Math.min(3, strikeouts) as 0 | 1 | 2 | 3,
      completed: true,
    }),
    status: 'completed', createdAt: '2026-10-15T12:00:00Z',
    updatedAt: '2026-10-15T13:00:00Z', completedAt: '2026-10-15T13:00:00Z',
  };
}
function setup(n: number) {
  const issued = challenge(n), saved = state(n);
  const dependencies = {
    getSecret: vi.fn(() => SECRET),
    challenge: vi.fn(async () => issued),
    attempt: vi.fn(async () => saved),
    admit: vi.fn(async (_input: CustomLineupV2AdmissionInput) =>
      ({ status: 'created' as 'created' | 'existing', submissionId: ATTEMPT })),
  };
  return { dependencies, saved, issued,
    service: createServerCustomLineupV2CompletedAdmissionService({
      environment: {}, dependencies,
    }),
  };
}
describe('private authoritative Custom v2 N-batter completed admission', () => {
  it.each([1, 5, 9, 10])('accepts exactly N=%i frozen facts and scores by points-v4', async n => {
    const s = setup(n);
    const result = await s.service.admit(ID, COOKIE);
    const expected = 4 * (n - Math.min(n, 4))
      + (n >= 1 ? 4 : 0) + (n >= 2 ? 0.5 : 0);
    // One HR on slot one and all slots >= five, BB on two and K on three/four.
    expect(result).toMatchObject({ kind: 'admitted', status: 'created', submissionId: ATTEMPT,
      summary: { points: expected, maximumPoints: 4 * n, atBatsCompleted: n,
        totalAtBats: n, completed: true, strikeouts: Math.min(2, Math.max(0, n - 2)) } });
    expect(s.dependencies.attempt).toHaveBeenCalledWith(ID, BROWSER.browserKeyDigest, n, {});
    const admission = s.dependencies.admit.mock.calls[0]![0];
    expect(admission).toMatchObject({
      challengeId: ID, browserKeyDigest: BROWSER.browserKeyDigest,
      submissionId: ATTEMPT, atBatCount: n, summary: { maximumPoints: 4 * n },
    });
    expect(admission.awardedPoints).toEqual(s.saved.terminalAtBats.map(f =>
      f.outcome === 'K' ? 0 : f.outcome === 'BB' ? 0.5 : 4));
    expect(admission).not.toHaveProperty('completedAtBats');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_');
    expect(JSON.stringify(result)).not.toContain('ibp_');
    expect(JSON.stringify(result)).not.toContain('progressionToken');
  });

  it('allows exact admission retries but never constructs a browser-selected submission', async () => {
    const s = setup(10);
    s.dependencies.admit.mockResolvedValue({ status: 'existing', submissionId: ATTEMPT });
    expect(await s.service.admit(ID, COOKIE)).toMatchObject({
      kind: 'admitted', status: 'existing', submissionId: ATTEMPT,
    });
    expect(s.dependencies.admit.mock.calls[0]![0].submissionId).toBe(s.saved.attemptId);
  });

  it('blocks creators, missing, duplicate, tampered and foreign browser credentials', async () => {
    const s = setup(5);
    const v1 = createCustomNineAttemptBrowserCredential(SECRET)
      .issue(V1, 'https://example.test').setCookie.split(';')[0]!;
    const foreign = createCustomLineupV2AttemptBrowserCredential(SECRET)
      .issue(OTHER, 'https://example.test').setCookie.split(';')[0]!;
    for (const header of [
      null, CREATOR, CREATOR + '; ' + COOKIE, COOKIE + '; ' + COOKIE,
      COOKIE.slice(0, -1) + '!', v1, foreign,
    ]) {
      expect(await s.service.admit(ID, header)).toEqual({ kind: 'invalid_credential' });
    }
    expect(await s.service.admit(V1, COOKIE)).toEqual({ kind: 'not_found' });
    s.dependencies.challenge.mockResolvedValueOnce(null as never);
    expect(await s.service.admit(ID, COOKIE)).toEqual({ kind: 'not_found' });
    expect(s.dependencies.attempt).not.toHaveBeenCalled();
    expect(s.dependencies.admit).not.toHaveBeenCalled();
  });

  it('never admits creator-seen completed attempts after account signout', async () => {
    const s = setup(5);
    s.dependencies.attempt.mockResolvedValueOnce({
      ...s.saved, creatorSeen: true as const,
    });
    expect(await s.service.admit(ID, COOKIE)).toEqual({ kind: 'invalid_credential' });
    expect(s.dependencies.admit).not.toHaveBeenCalled();
  });

  it('rejects missing, active and foreign saved attempts before scoring', async () => {
    const s = setup(5);
    s.dependencies.attempt.mockResolvedValueOnce(null as never);
    expect(await s.service.admit(ID, COOKIE)).toEqual({ kind: 'invalid_credential' });
    s.dependencies.attempt.mockResolvedValueOnce({
      ...s.saved, status: 'active', completedAt: null,
    });
    expect(await s.service.admit(ID, COOKIE)).toEqual({ kind: 'incomplete' });
    s.dependencies.attempt.mockResolvedValueOnce({
      ...s.saved, browserKeyDigest: 'other',
    });
    expect(await s.service.admit(ID, COOKIE)).toEqual({ kind: 'invalid_credential' });
    expect(s.dependencies.admit).not.toHaveBeenCalled();
  });

  it('fails closed for forged token, historical v1 token, state and fact inconsistencies', async () => {
    const s = setup(5);
    const saved = s.saved;
    const claims = TOKENS.verify(saved.currentProgressionToken);
    for (const damaged of [
      { ...saved, currentProgressionToken: 'tampered' },
      { ...saved, currentProgressionToken: createCustomNineProgressionTokens(SECRET).sign(claims) },
      { ...saved, currentProgressionToken: TOKENS.sign({ ...claims, completed: false }) },
      { ...saved, currentProgressionToken: TOKENS.sign({ ...claims, outCount: 0 }) },
      { ...saved, currentProgressionToken: TOKENS.sign({ ...claims, pitchNumber: 4 }) },
      { ...saved, revision: saved.revision + 1 },
      { ...saved, terminalAtBats: saved.terminalAtBats.slice(0, 4) },
      { ...saved, terminalAtBats: [{ ...saved.terminalAtBats[0]!, initials: 'WRONG' },
        ...saved.terminalAtBats.slice(1)] },
      { ...saved, terminalAtBats: [{ ...saved.terminalAtBats[0]!, outcome: 'K' as const },
        ...saved.terminalAtBats.slice(1)] },
    ]) {
      s.dependencies.attempt.mockResolvedValueOnce(damaged);
      await expect(s.service.admit(ID, COOKIE)).rejects.toThrow(
        'Invalid authoritative Custom Lineup v2 completed attempt.');
    }
    expect(s.dependencies.admit).not.toHaveBeenCalled();
  });

  it('fails closed for mismatched accepted winner and does not forward private DB details', async () => {
    const s = setup(9);
    s.dependencies.admit.mockResolvedValueOnce({ status: 'created', submissionId: 'other' });
    await expect(s.service.admit(ID, COOKIE)).rejects.toThrow(
      'Invalid authoritative Custom Lineup v2 completed attempt.');
  });
});
