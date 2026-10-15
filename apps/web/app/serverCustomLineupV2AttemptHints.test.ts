import { describe, expect, it, vi } from 'vitest';
import { createCustomLineupIssuedChallenge, createCustomLineupIssuedClueSnapshot } from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
vi.mock('server-only', () => ({}));

import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { createCustomLineupV2ProgressionTokens } from './serverCustomLineupV2Bootstrap';
import { CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerCustomLineupV2AttemptHintService } from './serverCustomLineupV2AttemptHints';
import { createCustomNineProgressionTokens } from './serverCustomNineBootstrap';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174001';
const SECRET = 'secure-v2-hint-credential-secret-with-more-than-32-characters';
const TOKENS = createCustomLineupV2ProgressionTokens(SECRET);
const IDS = Array.from({ length: 10 }, (_, i) => 'ibp_' + (i + 1).toString(16).padStart(20, '0'));
const claims = { version: 1 as const, rulesetVersion: 'points-v4' as const,
  puzzleId: ID, puzzleDate: CUSTOM_NINE_SESSION_DATE, pitchNumber: 1,
  revealCount: 0 as const, strikeCount: 0 as const, outCount: 0 as const,
  completed: false };
const INITIAL = TOKENS.sign(claims);
const issued = createCustomLineupV2AttemptBrowserCredential(SECRET).issue(ID, 'https://test.example/api/custom-lineup/challenges/' + ID);
const cookie = issued.setCookie.split(';')[0]!;

function challenge(n: number) {
  return createCustomLineupIssuedChallenge({
    puzzleId: ID, issuedAt: '2026-10-14T12:00:00Z',
    canonicalPlayerIds: IDS.slice(0, n),
    clueSnapshot: createCustomLineupIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: IDS.slice(0, n).map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1, canonicalPlayerId, initials: 'P' + (index + 1),
        hintValues: ['first decade', 'first teams', 'first position', 'first stats']
          .map(value => index === 0 ? value : 'PRIVATE_FUTURE_HINT'),
      })),
    }),
  });
}
function setup(n: number) {
  let saved: CustomNineAttemptState | null = {
    challengeId: ID, browserKeyDigest: issued.browserKeyDigest,
    attemptId: '123e4567-e89b-42d3-a456-426614174010',
    revision: 0, currentProgressionToken: INITIAL, terminalAtBats: [],
    status: 'active', createdAt: '2026-10-14T20:00:00Z',
    updatedAt: '2026-10-14T20:00:00Z', completedAt: null,
  };
  const repository = {
    getByKey: vi.fn(async () => saved ? { ...saved } : null),
    advanceHint: vi.fn(async (expected: CustomNineAttemptState, successor: string) => {
      if (!saved || saved.revision !== expected.revision
        || saved.currentProgressionToken !== expected.currentProgressionToken
        || saved.status !== 'active') return { status: 'conflict' as const };
      saved = { ...saved, revision: saved.revision + 1, currentProgressionToken: successor };
      return { status: 'advanced' as const, state: { ...saved } };
    }),
  };
  const dependencies = {
    readChallenge: vi.fn(async () => challenge(n)),
    repository: vi.fn(() => repository),
    resolvePlayer: vi.fn((id: string): Player | null => IDS.includes(id)
      ? { id, fullName: 'SECRET_ANSWER', displayName: 'SECRET_ANSWER',
          primaryRole: 'hitter', primaryPosition: 'RF' } as Player : null),
    getSecret: vi.fn(() => SECRET),
  };
  const service = createServerCustomLineupV2AttemptHintService({ dependencies });
  return { service, repository, dependencies, read: () => saved,
    replace: (state: CustomNineAttemptState | null) => { saved = state; } };
}

describe('private Custom Lineup v2 hint CAS', () => {
  it.each([1, 5, 9, 10])('reveals exactly one frozen hint for N=%i and preserves privacy', async n => {
    const s = setup(n);
    let token = INITIAL;
    for (let reveal = 1; reveal <= 4; reveal++) {
      const result = await s.service.reveal(ID, cookie, token);
      expect(result.kind).toBe('revealed');
      if (result.kind !== 'revealed') throw Error('missing hint');
      expect(result.hint.hintValue).toBe(['first decade','first teams','first position','first stats'][reveal - 1]);
      expect(TOKENS.verify(result.progressionToken).revealCount).toBe(reveal);
      expect(result.revision).toBe(reveal);
      expect(JSON.stringify(result)).not.toContain('PRIVATE_FUTURE_HINT');
      expect(JSON.stringify(result)).not.toContain('SECRET_ANSWER');
      expect(JSON.stringify(result)).not.toContain('ibp_');
      token = result.progressionToken;
    }
    expect(await s.service.reveal(ID, cookie, token)).toEqual({ kind: 'invalid_progression' });
    expect(s.repository.advanceHint).toHaveBeenCalledTimes(4);
    expect(s.read()?.terminalAtBats).toEqual([]);
  });

  it('rejects stale replay, and concurrent identical requests have one winner', async () => {
    const s = setup(10);
    const both = await Promise.all([
      s.service.reveal(ID, cookie, INITIAL), s.service.reveal(ID, cookie, INITIAL),
    ]);
    expect(both.map(x => x.kind).sort()).toEqual(['conflict', 'revealed']);
    expect(await s.service.reveal(ID, cookie, INITIAL)).toEqual({ kind: 'conflict' });
    expect(s.read()?.revision).toBe(1);
  });

  it('rejects missing, creator, invalid and cross-version credentials before mutation', async () => {
    const s = setup(5);
    const creator = createCustomLineupV2CreatorBrowserMarker(SECRET)
      .creatorCookie(ID, 'https://test.example').split(';')[0]!;
    const v1 = 'ib-custom-nine-attempt-v1-' + ID + '=unrelated';
    for (const candidate of [null, creator, cookie + '; ' + creator,
      cookie + '; ' + cookie, cookie.replace(/.$/, '!'), v1]) {
      expect(await s.service.reveal(ID, candidate, INITIAL)).toEqual({ kind: 'invalid_credential' });
    }
    expect(s.repository.getByKey).not.toHaveBeenCalled();
  });

  it('rejects unknown challenge, malformed, foreign, legacy or noncanonical signed tokens', async () => {
    const s = setup(1);
    s.dependencies.readChallenge.mockResolvedValueOnce(null as never);
    expect(await s.service.reveal(ID, cookie, INITIAL)).toEqual({ kind: 'not_found' });
    for (const bad of [
      TOKENS.sign({ ...claims, puzzleId: OTHER }),
      TOKENS.sign({ ...claims, puzzleDate: '2026-10-14' }),
      TOKENS.sign({ ...claims, pitchNumber: 2 }),
      TOKENS.sign({ ...claims, completed: true }),
      createCustomNineProgressionTokens(SECRET).sign({ ...claims, pitchNumber: 1 }),
      createDailyProgressionTokenCodec(SECRET).sign({ ...claims, pitchNumber: 1 }),
      'tampered', INITIAL.slice(0, -2) + '!!',
    ]) expect(await s.service.reveal(ID, cookie, bad)).toEqual({ kind: 'invalid_progression' });
    expect(await s.service.reveal('bad-id', cookie, INITIAL)).toEqual({ kind: 'not_found' });
    expect(s.repository.advanceHint).not.toHaveBeenCalled();
  });

  it('fails closed for missing/completed and inconsistent persisted state', async () => {
    const s = setup(5);
    const original = s.read()!;
    s.replace(null);
    expect(await s.service.reveal(ID, cookie, INITIAL)).toEqual({ kind: 'invalid_credential' });
    s.replace({ ...original, status: 'completed', completedAt: '2026-10-14T20:01:00Z' });
    expect(await s.service.reveal(ID, cookie, INITIAL)).toEqual({ kind: 'completed' });
    s.replace({ ...original, revision: 1 });
    expect(await s.service.reveal(ID, cookie, INITIAL)).toEqual({ kind: 'invalid_progression' });
    s.replace({ ...original, revision: 1, currentProgressionToken: TOKENS.sign({ ...claims, revealCount: 1 }) });
    expect(await s.service.reveal(ID, cookie, INITIAL)).toEqual({ kind: 'conflict' });
    expect(s.repository.advanceHint).not.toHaveBeenCalled();
  });

  it('returns conflict and never discloses the uncommitted hint on failed CAS', async () => {
    const s = setup(10);
    s.repository.advanceHint.mockResolvedValueOnce({ status: 'conflict' } as never);
    expect(await s.service.reveal(ID, cookie, INITIAL)).toEqual({ kind: 'conflict' });
  });
});
