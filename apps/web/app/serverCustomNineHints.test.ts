import {
  createCustomNineIssuedChallenge,
  createPermanentDailyIssuedClueSnapshot,
  type CustomNineIssuedChallengeRepository,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
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
          : [FUTURE, FUTURE, FUTURE, FUTURE],
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
    vi.mocked(failure.repository.getById).mockRejectedValueOnce(new Error('PRIVATE_DATABASE_CREDENTIAL'));
    await expect(failure.service.getHintBundle(ID, failure.token)).rejects.toThrow();
  });
});
