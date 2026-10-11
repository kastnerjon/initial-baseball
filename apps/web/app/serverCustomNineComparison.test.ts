import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { createCustomNineAttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';
import { createServerCustomNineComparisonService, type CustomNineComparisonResult } from './serverCustomNineComparison';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const ATTEMPT = '123e4567-e89b-42d3-a456-426614174010';
const SECRET = 'private-custom-comparison-test-secret-sufficiently-long';
const issued = createCustomNineAttemptBrowserCredential(SECRET).issue(ID, 'https://example.test');
const cookie = issued.setCookie.split(';')[0]!;
const creator = createCustomNineCreatorBrowserMarker(SECRET)
  .creatorCookie(ID, 'https://example.test').split(';')[0]!;
const facts: DailyCompletedAtBat[] = Array.from({ length: 9 }, (_, index) => ({
  pitchNumber: index + 1, initials: 'P' + (index + 1),
  outcome: 'HR', hintsRevealed: 0, wrongGuesses: 0, resolution: 'correct',
}));
const attempt: CustomNineAttemptState = {
  challengeId: ID, browserKeyDigest: issued.browserKeyDigest, attemptId: ATTEMPT,
  revision: 9, currentProgressionToken: 'server-verified-token',
  terminalAtBats: facts, status: 'completed',
  createdAt: '2026-10-11T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z',
  completedAt: '2026-10-11T00:00:00Z',
};
const peerPayload: Omit<Extract<CustomNineComparisonResult, { kind: 'ready' }>, 'kind'> = {
  completed: { completedGameCount: 1, averageTotalPoints: 24.5, scoreHistogram: Array(73).fill(0) as number[] },
  atBats: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1, resolvedAtBatCount: 1,
    averagePoints: 0.5, scoreHistogram: Array(9).fill(0) as number[],
  })),
};

function setup(options: { challenge?: boolean; attempt?: CustomNineAttemptState | null; admitted?: boolean } = {}) {
  const deps = {
    getSecret: vi.fn(() => SECRET),
    challengeExists: vi.fn(async () => options.challenge ?? true),
    getAttempt: vi.fn(async () => options.attempt === undefined ? attempt : options.attempt),
    hasAcceptedResult: vi.fn(async () => options.admitted ?? true),
    readPeers: vi.fn(async () => peerPayload),
  };
  return { deps, service: createServerCustomNineComparisonService({
    environment: {}, dependencies: deps,
  }) };
}

describe('private Custom Nine comparison composition', () => {
  it('uses signed browser credential and its exact completed server-ledger attempt for own exclusion', async () => {
    const { deps, service } = setup();
    const result = await service.read(ID, cookie);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') throw new Error('Comparison expected.');
    expect(result.atBats).toHaveLength(9);
    expect(result.completed.completedGameCount).toBe(1);
    expect(deps.challengeExists).toHaveBeenCalledWith(ID, {});
    expect(deps.getAttempt).toHaveBeenCalledWith(ID, issued.browserKeyDigest, {});
    expect(deps.hasAcceptedResult).toHaveBeenCalledWith(ID, ATTEMPT, {});
    expect(deps.readPeers).toHaveBeenCalledWith(ID, ATTEMPT, {});
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(ATTEMPT);
    expect(serialized).not.toContain(issued.browserKeyDigest);
    expect(serialized).not.toContain('terminalAtBats');
    expect(serialized).not.toContain('P1');
  });

  it('rejects creators, absent/invalid cookies and cookies for another challenge without reads', async () => {
    const { deps, service } = setup();
    for (const header of [null, '', cookie + '; ' + creator, cookie + '; ' + cookie,
      createCustomNineAttemptBrowserCredential(SECRET).issue(OTHER, 'https://example.test').setCookie.split(';')[0]!]) {
      expect((await service.read(ID, header)).kind).toBe('ineligible');
    }
    expect(deps.getAttempt).not.toHaveBeenCalled();
    expect(deps.readPeers).not.toHaveBeenCalled();
  });

  it('does not admit a challenge URL or a mismatched/nonterminal ledger as eligibility', async () => {
    const bad = setup({ challenge: false });
    expect(await bad.service.read(ID, cookie)).toEqual({ kind: 'not_found' });
    expect(bad.deps.getAttempt).not.toHaveBeenCalled();
    const mismatch = setup({ attempt: { ...attempt, challengeId: OTHER } });
    expect(await mismatch.service.read(ID, cookie)).toEqual({ kind: 'ineligible' });
    expect(mismatch.deps.readPeers).not.toHaveBeenCalled();
    const unfinished = setup({ attempt: { ...attempt, status: 'active', completedAt: null,
      terminalAtBats: facts.slice(0, 8) } });
    expect(await unfinished.service.read(ID, cookie)).toEqual({ kind: 'incomplete' });
    expect(unfinished.deps.readPeers).not.toHaveBeenCalled();
    expect(await setup().service.read('invalid-id', cookie)).toEqual({ kind: 'not_found' });
  });

  it('denies private cohorts when a completed ledger has no accepted completed result', async () => {
    const { deps, service } = setup({ admitted: false });
    expect(await service.read(ID, cookie)).toEqual({ kind: 'not_admitted' });
    expect(deps.hasAcceptedResult).toHaveBeenCalledWith(ID, ATTEMPT, {});
    expect(deps.readPeers).not.toHaveBeenCalled();
  });

  it('fails closed without returning private SQL errors when admission lookup errors', async () => {
    const { deps, service } = setup();
    deps.hasAcceptedResult.mockRejectedValueOnce(new Error('INTERNAL_DB_SECRET'));
    await expect(service.read(ID, cookie)).rejects.toThrow('INTERNAL_DB_SECRET');
    expect(deps.readPeers).not.toHaveBeenCalled();
  });

  it('remains challenge-scoped across two independent browser credentials', async () => {
    const issuedOther = createCustomNineAttemptBrowserCredential(SECRET)
      .issue(OTHER, 'https://example.test');
    const other = setup({ attempt: {
      ...attempt, challengeId: OTHER, browserKeyDigest: issuedOther.browserKeyDigest,
    } });
    const answer = await other.service.read(OTHER, issuedOther.setCookie.split(';')[0]!);
    expect(answer.kind).toBe('ready');
    expect(other.deps.readPeers).toHaveBeenCalledWith(OTHER, ATTEMPT, {});
  });

  it('allows zero-peer histograms as a private no-results state without leaking details', async () => {
    const s = setup();
    s.deps.readPeers.mockResolvedValueOnce({
      completed: { completedGameCount: 0, averageTotalPoints: null,
        scoreHistogram: Array(73).fill(0) },
      atBats: Array.from({ length: 9 }, (_, i) => ({
        pitchNumber: i + 1, resolvedAtBatCount: 0, averagePoints: null,
        scoreHistogram: Array(9).fill(0),
      })),
    });
    const value = await s.service.read(ID, cookie);
    expect(value.kind).toBe('ready');
    if (value.kind !== 'ready') throw new Error('Expected private result.');
    expect(value.completed.averageTotalPoints).toBeNull();
  });
});
