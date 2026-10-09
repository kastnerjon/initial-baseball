import {
  createCustomNineIssuedChallenge,
  createPermanentDailyIssuedClueSnapshot,
  type CustomNineIssuedChallengeRepository,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createDailyProgressionTokenCodec, type DailyProgressionClaims } from './dailyProgressionToken';
import { CustomNineHintRequestError, createServerCustomNineHintService } from './serverCustomNineHints';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER_ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const IDS = Array.from({ length: 9 }, (_, i) => 'ibp_' + (i + 1).toString(16).padStart(20, '0'));
const SECRET = 'a-long-configured-progression-signature-secret-for-testing';
const FUTURE = 'PRIVATE_FUTURE_BATTER_HINT';
const PRIVATE_NAME = 'PRIVATE_CANONICAL_ANSWER_NAME';

function challenge() {
  return createCustomNineIssuedChallenge({
    puzzleId: ID, issuedAt: '2026-10-09T15:00:00Z', canonicalPlayerIds: IDS,
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: IDS.map((canonicalPlayerId, i) => ({
        pitchNumber: i + 1, canonicalPlayerId, initials: 'P' + (i + 1),
        hintValues: i === 0 ? ['HINT_1', 'HINT_2', 'HINT_3', 'HINT_4']
          : [FUTURE + '_P' + (i + 1), FUTURE + '_P' + (i + 1), FUTURE + '_P' + (i + 1), FUTURE + '_P' + (i + 1)],
      })),
    }),
  });
}

function setup(stored: unknown | null = challenge()) {
  const repository: CustomNineIssuedChallengeRepository = {
    getById: vi.fn(async () => stored),
    insertIfAbsent: vi.fn(async c => ({ status: 'inserted' as const, challenge: c })),
  };
  const dependencies = {
    resolveLegacyPlayerId: vi.fn((id: string): string => {
      if (id === 'legacy_correct') return IDS[0]!;
      throw new Error('Unknown player');
    }),
    getCanonicalReveal: vi.fn((id: string): CanonicalPlayerReveal => ({
      playerId: id, displayName: PRIVATE_NAME + id.slice(-2), playerType: 'hitter',
      career: {
        primaryPosition: 'RF', firstSeason: 1999, lastSeason: 2009,
        teamIds: [], batting: null, pitching: null, advanced: null,
      },
      seasons: [],
    }) as unknown as CanonicalPlayerReveal),
    createSupabaseClient: vi.fn(() => ({} as SupabaseClient)),
    createRepository: vi.fn(() => repository),
    resolvePlayer: vi.fn((id: string): Player | null => IDS.includes(id)
      ? { id, fullName: PRIVATE_NAME, displayName: PRIVATE_NAME, primaryRole: 'hitter', primaryPosition: 'RF' } as Player
      : null),
    getProgressionSecret: vi.fn(() => SECRET),
  };
  const service = createServerCustomNineHintService({ dependencies, environment: {} });
  const tokens = createCustomNineProgressionTokens(SECRET);
  const claims: DailyProgressionClaims = {
    version: 1, rulesetVersion: 'points-v4', puzzleId: ID, puzzleDate: CUSTOM_NINE_SESSION_DATE,
    pitchNumber: 1, revealCount: 0, strikeCount: 0, outCount: 0, completed: false,
  };
  return { service, repository, dependencies, tokens, claims, token: tokens.sign(claims) };
}

describe('Custom Nine signed hint progression', () => {
  it('rehydrates only the active frozen bundle and advances by exactly one reveal', async () => {
    const { service, tokens, claims, token, repository } = setup();
    const restored = await service.getHintBundle(ID, token);
    expect(restored?.hintBundle).toMatchObject({ pitchNumber: 1, revealedCount: 0 });
    expect(restored?.hintBundle.hints.map(h => h.hintValue)).toEqual(['HINT_1', 'HINT_2', 'HINT_3', 'HINT_4']);
    expect(restored?.hintBundle.checkpoints).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const checkpoint = restored!.hintBundle.checkpoints[i]!;
      expect(tokens.verify(checkpoint.progressionToken)).toEqual({ ...claims, revealCount: i + 1 });
      const next = await service.revealHint(ID, tokens.sign({ ...claims, revealCount: i as 0 | 1 | 2 | 3 }));
      expect(next?.hint.hintValue).toBe('HINT_' + (i + 1));
      expect(tokens.verify(next!.progressionToken)).toEqual({ ...claims, revealCount: i + 1 });
    }
    const last = await service.getHintBundle(ID, tokens.sign({ ...claims, revealCount: 4 }));
    expect(last?.hintBundle.checkpoints).toHaveLength(0);
    await expect(service.revealHint(ID, tokens.sign({ ...claims, revealCount: 4 })))
      .rejects.toBeInstanceOf(CustomNineHintRequestError);
    for (const reply of [restored, last]) {
      const serialized = JSON.stringify(reply);
      for (const hidden of [...IDS, FUTURE, PRIVATE_NAME, 'canonicalPlayerIds', 'clueSnapshot']) {
        expect(serialized).not.toContain(hidden);
      }
    }
    expect(repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('refuses malformed, forged, Universal, mismatched, incompatible and completed tokens before private reads', async () => {
    const { service, repository, dependencies, tokens, claims } = setup();
    const invalid = [
      '', 7, 'nonsense', 'v1.invalid.invalid',
      createDailyProgressionTokenCodec(SECRET).sign(claims),
      tokens.sign({ ...claims, puzzleId: OTHER_ID }),
      tokens.sign({ ...claims, puzzleDate: '2026-10-09' }),
      tokens.sign({ ...claims, rulesetVersion: 'points-v3' }),
      tokens.sign({ ...claims, completed: true }),
    ];
    for (const value of invalid) {
      await expect(service.getHintBundle(ID, value)).rejects.toBeInstanceOf(CustomNineHintRequestError);
      await expect(service.revealHint(ID, value)).rejects.toBeInstanceOf(CustomNineHintRequestError);
    }
    expect(dependencies.createSupabaseClient).not.toHaveBeenCalled();
    expect(repository.getById).not.toHaveBeenCalled();
  });

  it('rejects bad IDs before persistence and returns null for missing challenges', async () => {
    const ctx = setup();
    expect(await ctx.service.getHintBundle('malformed', ctx.token)).toBeNull();
    expect(ctx.dependencies.createSupabaseClient).not.toHaveBeenCalled();
    const missing = setup(null);
    expect(await missing.service.revealHint(ID, missing.token)).toBeNull();
  });

  it('supports an independently signed later-batter state without exposing the rest of the lineup', async () => {
    const ctx = setup();
    const reply = await ctx.service.getHintBundle(ID, ctx.tokens.sign({
      ...ctx.claims, pitchNumber: 2, revealCount: 2, strikeCount: 1,
    }));
    expect(reply?.hintBundle).toMatchObject({ pitchNumber: 2, revealedCount: 2 });
    expect(reply?.hintBundle.checkpoints.map(x => x.revealedCount)).toEqual([3, 4]);
    expect(JSON.stringify(reply)).not.toContain(IDS[1]!);
    expect(JSON.stringify(reply)).not.toContain(PRIVATE_NAME);
    expect(JSON.stringify(reply)).not.toContain('P3');
  });

  it('fails closed on invalid frozen records, missing players and provider errors', async () => {
    const invalid = setup({ puzzleId: ID, schemaVersion: 12 });
    await expect(invalid.service.getHintBundle(ID, invalid.token)).rejects.toThrow();
    const missing = setup();
    missing.dependencies.resolvePlayer.mockReturnValueOnce(null);
    await expect(missing.service.getHintBundle(ID, missing.token)).rejects.toThrow();
    const failure = setup();
    vi.mocked(failure.repository.getById).mockRejectedValueOnce(new Error('SANITIZED_BACKEND_SENTINEL'));
    await expect(failure.service.getHintBundle(ID, failure.token)).rejects.toThrow();
  });
});

describe('Custom Nine signed guess resolution', () => {
  const WRONG = 'ibp_ffffffffffffffffffff';

  it('an incorrect guess preserves the current batter without revealing private answers', async () => {
    const ctx = setup();
    const reply = await ctx.service.resolveAtBat(ID, {
      progressionToken: ctx.token, submittedPlayerId: WRONG,
    });
    expect(reply?.result.kind).toBe('incorrect');
    expect(reply?.reveal).toBeNull();
    expect(reply?.hintBundle).toMatchObject({ pitchNumber: 1, revealedCount: 0 });
    expect(ctx.tokens.verify(reply!.progressionToken)).toEqual({ ...ctx.claims, strikeCount: 1 });
    expect(ctx.dependencies.getCanonicalReveal).not.toHaveBeenCalled();
    const json = JSON.stringify(reply);
    for (const secret of [...IDS, PRIVATE_NAME, FUTURE]) expect(json).not.toContain(secret);
    expect(ctx.repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('third strike and Give Up reveal only the resolved batter and next authorized hints', async () => {
    const ctx = setup();
    let token = ctx.token;
    for (let i = 0; i < 2; i++) {
      const wrong = await ctx.service.resolveAtBat(ID, { progressionToken: token, submittedPlayerId: WRONG });
      token = wrong!.progressionToken;
      expect(ctx.dependencies.getCanonicalReveal).not.toHaveBeenCalled();
    }
    const result = await ctx.service.resolveAtBat(ID, { progressionToken: token, submittedPlayerId: WRONG });
    expect(result?.result.kind).toBe('strikeout');
    expect(result?.reveal?.playerId).toBe(IDS[0]);
    expect(result?.hintBundle?.pitchNumber).toBe(2);
    expect(ctx.tokens.verify(result!.progressionToken)).toEqual({ ...ctx.claims, pitchNumber: 2, outCount: 1 });
    expect(ctx.dependencies.getCanonicalReveal).toHaveBeenCalledOnce();
    expect(ctx.dependencies.getCanonicalReveal).toHaveBeenCalledWith(IDS[0]);
    const json = JSON.stringify(result);
    expect(json).toContain(FUTURE + '_P2');
    expect(json).not.toContain(FUTURE + '_P3');
    for (const id of IDS.slice(1)) expect(json).not.toContain(id);
    const gaveUp = await setup().service.resolveAtBat(ID, { progressionToken: ctx.token, giveUp: true });
    expect(gaveUp?.result.kind).toBe('strikeout');
    expect(gaveUp?.reveal?.playerId).toBe(IDS[0]);
  });

  it('correct guesses use signed hint depth and complete only after the ninth batter', async () => {
    const ctx = setup();
    const opened = await ctx.service.getHintBundle(ID, ctx.token);
    let token = opened!.hintBundle.checkpoints[2]!.progressionToken;
    const first = await ctx.service.resolveAtBat(ID, { progressionToken: token, submittedPlayerId: IDS[0]! });
    expect(first?.result).toMatchObject({ kind: 'correct', revealedCount: 3 });
    expect(first?.reveal?.playerId).toBe(IDS[0]);
    expect(first?.hintBundle?.pitchNumber).toBe(2);
    token = first!.progressionToken;
    for (let index = 1; index < 9; index++) {
      const reply = await ctx.service.resolveAtBat(ID, {
        progressionToken: token, submittedPlayerId: IDS[index]!,
      });
      expect(reply?.result.kind).toBe('correct');
      expect(reply?.reveal?.playerId).toBe(IDS[index]);
      if (index === 8) {
        expect(reply?.hintBundle).toBeNull();
        expect(ctx.tokens.verify(reply!.progressionToken)).toEqual({
          ...ctx.claims, pitchNumber: 9, completed: true,
        });
        await expect(ctx.service.resolveAtBat(ID, {
          progressionToken: reply!.progressionToken, giveUp: true,
        })).rejects.toBeInstanceOf(CustomNineHintRequestError);
      } else {
        expect(reply?.hintBundle?.pitchNumber).toBe(index + 2);
        const json = JSON.stringify(reply);
        expect(json).not.toContain(FUTURE + '_P' + (index + 3));
        for (const id of IDS.slice(index + 2)) expect(json).not.toContain(id);
      }
      token = reply!.progressionToken;
    }
    expect(ctx.repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('rejects Universal, wrong challenge/ruleset/date, and completed tokens without Supabase reads', async () => {
    const ctx = setup();
    const invalid = [
      createDailyProgressionTokenCodec(SECRET).sign(ctx.claims),
      ctx.tokens.sign({ ...ctx.claims, puzzleId: OTHER_ID }),
      ctx.tokens.sign({ ...ctx.claims, rulesetVersion: 'points-v3' }),
      ctx.tokens.sign({ ...ctx.claims, puzzleDate: '2026-10-09' }),
      ctx.tokens.sign({ ...ctx.claims, completed: true }),
      'invalid.signature',
    ];
    for (const token of invalid) {
      await expect(ctx.service.resolveAtBat(ID, {
        progressionToken: token, submittedPlayerId: IDS[0]!,
      })).rejects.toBeInstanceOf(CustomNineHintRequestError);
    }
    expect(ctx.dependencies.createSupabaseClient).not.toHaveBeenCalled();
    expect(ctx.repository.getById).not.toHaveBeenCalled();
  });

  it('resolves legacy IDs only through the established canonical redirect boundary', async () => {
    const ctx = setup();
    const alias = await ctx.service.resolveAtBat(ID, {
      progressionToken: ctx.token, submittedPlayerId: 'legacy_correct',
    });
    expect(alias?.result.kind).toBe('correct');
    expect(ctx.dependencies.resolveLegacyPlayerId).toHaveBeenCalledWith('legacy_correct');
    const direct = await ctx.service.resolveAtBat(ID, {
      progressionToken: ctx.token, submittedPlayerId: IDS[0]!,
    });
    expect(direct?.result.kind).toBe('correct');
    expect(ctx.dependencies.resolveLegacyPlayerId).toHaveBeenCalledTimes(1);
    await expect(ctx.service.resolveAtBat(ID, {
      progressionToken: ctx.token, submittedPlayerId: 'unknown_legacy',
    })).rejects.toBeInstanceOf(CustomNineHintRequestError);
  });

  it('fails closed on mismatched terminal reveal identity', async () => {
    const ctx = setup();
    ctx.dependencies.getCanonicalReveal.mockImplementationOnce(() => ({
      playerId: IDS[1], displayName: 'INCORRECT_REVEAL',
    } as unknown as CanonicalPlayerReveal));
    await expect(ctx.service.resolveAtBat(ID, {
      progressionToken: ctx.token, submittedPlayerId: IDS[0]!,
    })).rejects.toThrow('Canonical reveal identity mismatch');
  });
});
