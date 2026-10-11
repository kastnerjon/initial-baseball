import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import type { CustomNineIssuedChallenge } from '@initial-baseball/daily';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import type { CustomNineAdmissionInput } from './supabaseCustomNineAdmissionRepository';
import { createCustomNineAttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerCustomNineCompletedAdmissionService } from './serverCustomNineCompletedAdmission';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const ATTEMPT = '123e4567-e89b-42d3-a456-426614174010';
const SECRET = 'custom-nine-admission-test-secret-of-sufficient-length';
const issued = createCustomNineAttemptBrowserCredential(SECRET).issue(ID, 'https://example.test');
const cookie = issued.setCookie.split(';')[0]!;
const creator = createCustomNineCreatorBrowserMarker(SECRET)
  .creatorCookie(ID, 'https://example.test').split(';')[0]!;
const facts: DailyCompletedAtBat[] = Array.from({ length: 9 }, (_, i): DailyCompletedAtBat => ({
  pitchNumber: i + 1, initials: 'P' + (i + 1),
  outcome: i === 3 ? 'BB' : i === 5 ? 'K' : 'HR',
  hintsRevealed: i === 3 ? 4 : 0,
  wrongGuesses: i === 5 ? 3 : 0,
  resolution: i === 5 ? 'strikeout' : 'correct',
}));
const token = createCustomNineProgressionTokens(SECRET).sign({
  version: 1, rulesetVersion: 'points-v4', puzzleId: ID,
  puzzleDate: CUSTOM_NINE_SESSION_DATE,
  pitchNumber: 9, revealCount: 0, strikeCount: 0,
  outCount: 1, completed: true,
});
const challenge = {
  puzzleId: ID, rulesetVersion: 'points-v4',
  clueSnapshot: { pitches: facts.map(fact => ({
    pitchNumber: fact.pitchNumber, initials: fact.initials,
  })) },
} as unknown as CustomNineIssuedChallenge;
const state: CustomNineAttemptState = {
  challengeId: ID, browserKeyDigest: issued.browserKeyDigest, attemptId: ATTEMPT,
  revision: 9, currentProgressionToken: token,
  terminalAtBats: facts, status: 'completed',
  createdAt: '2026-10-10T12:00:00Z', updatedAt: '2026-10-10T13:00:00Z',
  completedAt: '2026-10-10T13:00:00Z',
};
function setup() {
  const deps = {
    getSecret: vi.fn(() => SECRET),
    challenge: vi.fn(async (_id: string, _environment: Record<string, string | undefined>) => challenge),
    attempt: vi.fn(async (_id: string, _digest: string, _environment: Record<string, string | undefined>) => state),
    admit: vi.fn(async (_input: CustomNineAdmissionInput, _environment: Record<string, string | undefined>) =>
      ({ status: 'created' as 'created' | 'existing', submissionId: ATTEMPT })),
  };
  return {
    deps,
    service: createServerCustomNineCompletedAdmissionService({
      environment: {}, dependencies: deps,
    }),
  };
}

describe('server-authoritative Custom Nine completed-result admission (not exposed to HTTP)', () => {
  it('reads the frozen nine and ledger, derives score and nine awards, then admits once', async () => {
    const { service, deps } = setup();
    const result = await service.admit(ID, cookie);
    expect(result).toMatchObject({
      kind: 'admitted', status: 'created', submissionId: ATTEMPT,
      summary: { points: 28.5, maximumPoints: 36, totalAtBats: 9,
        atBatsCompleted: 9, completed: true, strikeouts: 1 },
    });
    expect(deps.attempt).toHaveBeenCalledWith(ID, issued.browserKeyDigest, {});
    const payload = deps.admit.mock.calls[0]![0];
    expect(payload).toMatchObject({
      challengeId: ID, browserKeyDigest: issued.browserKeyDigest,
      submissionId: ATTEMPT, summary: { points: 28.5 },
    });
    expect(payload.awardedPoints).toEqual([4, 4, 4, 0.5, 4, 0, 4, 4, 4]);
    expect(payload).not.toHaveProperty('completedAtBats');
  });

  it('allows an exact retry to return the one existing result identity', async () => {
    const { service, deps } = setup();
    deps.admit.mockResolvedValue({ status: 'existing', submissionId: ATTEMPT });
    expect(await service.admit(ID, cookie)).toMatchObject({
      kind: 'admitted', status: 'existing', submissionId: ATTEMPT,
    });
    expect(deps.admit).toHaveBeenCalledTimes(1);
  });

  it('rejects creators, invalid/absent credentials and unknown challenges before admission', async () => {
    const { service, deps } = setup();
    for (const header of [null, creator, creator + '; ' + cookie, cookie + '; ' + cookie,
      cookie + 'x']) {
      expect(await service.admit(ID, header)).toEqual({ kind: 'invalid_credential' });
    }
    expect(await service.admit('daily-1', cookie)).toEqual({ kind: 'not_found' });
    deps.challenge.mockResolvedValueOnce(null as never);
    expect(await service.admit(OTHER, null)).toEqual({ kind: 'not_found' });
    expect(deps.attempt).not.toHaveBeenCalled();
    expect(deps.admit).not.toHaveBeenCalled();
  });

  it('rejects active, missing or cross-credential states without a score write', async () => {
    const { service, deps } = setup();
    deps.attempt.mockResolvedValueOnce(null as never);
    expect(await service.admit(ID, cookie)).toEqual({ kind: 'invalid_credential' });
    deps.attempt.mockResolvedValueOnce({ ...state, status: 'active', completedAt: null });
    expect(await service.admit(ID, cookie)).toEqual({ kind: 'incomplete' });
    deps.attempt.mockResolvedValueOnce({ ...state, browserKeyDigest: 'other' });
    expect(await service.admit(ID, cookie)).toEqual({ kind: 'invalid_credential' });
    expect(deps.admit).not.toHaveBeenCalled();
  });

  it('fails closed on forged terminal token, wrong frozen initials and incomplete facts', async () => {
    for (const damaged of [
      { ...state, currentProgressionToken: 'tampered' },
      { ...state, terminalAtBats: facts.slice(0, 8) },
      { ...state, terminalAtBats: [{ ...facts[0]!, initials: 'SECRET_ANSWER' }, ...facts.slice(1)] },
    ]) {
      const { service, deps } = setup();
      deps.attempt.mockResolvedValueOnce(damaged);
      await expect(service.admit(ID, cookie)).rejects.toThrow(
        'Invalid authoritative Custom Nine completed attempt.');
      expect(deps.admit).not.toHaveBeenCalled();
    }
  });

  it('fails closed if the atomic provider returns a different accepted identity', async () => {
    const { service, deps } = setup();
    deps.admit.mockResolvedValueOnce({ status: 'created', submissionId: 'other' });
    await expect(service.admit(ID, cookie)).rejects.toThrow('Invalid authoritative Custom Nine');
  });
});
