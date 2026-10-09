import {
  createCustomNineIssuedChallenge,
  createPermanentDailyIssuedClueSnapshot,
  type CustomNineIssuedChallengeRepository,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createCustomNineProgressionTokens,
  createServerCustomNineBootstrapService,
  CUSTOM_NINE_SESSION_DATE,
} from './serverCustomNineBootstrap';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const IDS = Array.from({ length: 9 }, (_, i) => 'ibp_' + (i + 1).toString(16).padStart(20, '0'));
const SECRET = 'a-long-configured-progression-signature-secret-for-testing';
const FUTURE_HINT = 'FUTURE_PITCH_SECRET_STATS';
const ANSWER_NAME = 'CANONICAL_PRIVATE_FULL_NAME';

function challenge() {
  return createCustomNineIssuedChallenge({
    puzzleId: ID, canonicalPlayerIds: IDS, issuedAt: '2026-10-09T15:00:00Z',
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: IDS.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1, canonicalPlayerId, initials: 'P' + (index + 1),
        hintValues: index === 0
          ? ['CURRENT_FIRST_HINT', 'CURRENT_SECOND_HINT', 'CURRENT_THIRD_HINT', 'CURRENT_FOURTH_HINT']
          : [FUTURE_HINT, FUTURE_HINT, FUTURE_HINT, FUTURE_HINT],
      })),
    }),
  });
}

function setup(stored: unknown | null = challenge()) {
  const repo: CustomNineIssuedChallengeRepository = {
    getById: vi.fn(async () => stored),
    insertIfAbsent: vi.fn(async c => ({ status: 'inserted' as const, challenge: c })),
  };
  const dbClient = {} as SupabaseClient;
  const resolvePlayer = vi.fn((canonicalId: string): Player | null => {
    if (!IDS.includes(canonicalId)) return null;
    return { id: canonicalId, fullName: ANSWER_NAME, displayName: ANSWER_NAME,
      primaryRole: 'hitter', primaryPosition: 'RF' } as Player;
  });
  const env = { DAILY_PROGRESSION_SECRET: SECRET };
  const deps = {
    createSupabaseClient: vi.fn(() => dbClient),
    createRepository: vi.fn(() => repo),
    resolvePlayer,
    getProgressionSecret: vi.fn(() => SECRET),
  };
  const service = createServerCustomNineBootstrapService({ environment: env, dependencies: deps });
  return { service, deps, repo };
}

describe('signed Custom Nine bootstrap', () => {
  it('issues only first-batter hints and scoped checkpoints without leaking future clues or answers', async () => {
    const { service, repo, deps } = setup();
    const bootstrap = await service.bootstrap(ID);
    expect(bootstrap).not.toBeNull();
    expect(Object.keys(bootstrap ?? {})).toEqual([
      'puzzleId', 'rulesetVersion', 'atBats', 'progressionToken', 'hintBundle',
    ]);
    expect(bootstrap?.rulesetVersion).toBe('points-v4');
    expect(bootstrap?.atBats).toEqual(
      IDS.map((_, i) => ({ pitchNumber: i + 1, initials: 'P' + (i + 1) })),
    );
    expect(bootstrap?.hintBundle.hints.map(h => h.hintValue)).toEqual([
      'CURRENT_FIRST_HINT', 'CURRENT_SECOND_HINT', 'CURRENT_THIRD_HINT', 'CURRENT_FOURTH_HINT',
    ]);
    expect(bootstrap?.hintBundle.checkpoints).toHaveLength(4);
    const codec = createCustomNineProgressionTokens(SECRET);
    const claims = codec.verify(bootstrap!.progressionToken);
    expect(claims).toMatchObject({
      version: 1, puzzleId: ID, rulesetVersion: 'points-v4',
      puzzleDate: CUSTOM_NINE_SESSION_DATE, pitchNumber: 1,
      revealCount: 0, strikeCount: 0, outCount: 0, completed: false,
    });
    for (const [i, checkpoint] of bootstrap!.hintBundle.checkpoints.entries()) {
      expect(codec.verify(checkpoint.progressionToken)).toEqual({ ...claims, revealCount: i + 1 });
    }
    const json = JSON.stringify(bootstrap);
    for (const secret of [...IDS, FUTURE_HINT, ANSWER_NAME, 'canonicalPlayerIds', 'clueSnapshot', 'issuedAt']) {
      expect(json).not.toContain(secret);
    }
    expect(repo.getById).toHaveBeenCalledOnce();
    expect(repo.insertIfAbsent).not.toHaveBeenCalled();
    expect(deps.resolvePlayer).toHaveBeenCalledTimes(9);
  });

  it('cryptographically isolates Custom tokens from the existing Daily token domain', async () => {
    const custom = createCustomNineProgressionTokens(SECRET);
    const daily = createDailyProgressionTokenCodec(SECRET);
    const claims = custom.verify((await setup().service.bootstrap(ID))!.progressionToken);
    expect(() => daily.verify(custom.sign(claims))).toThrow();
    expect(() => custom.verify(daily.sign(claims))).toThrow();
    expect(custom.sign(claims)).not.toBe(daily.sign(claims));
    expect(createCustomNineProgressionTokens(SECRET).verify(custom.sign(claims))).toEqual(claims);
  });

  it.each([null, 7, '', 'not-an-id',
    'custom-nine-v1-123e4567-e89b-12d3-a456-426614174000'])(
    'rejects invalid puzzle IDs %s before reading Supabase or signing', async id => {
      const { service, repo, deps } = setup();
      expect(await service.bootstrap(id)).toBeNull();
      expect(deps.createSupabaseClient).not.toHaveBeenCalled();
      expect(deps.getProgressionSecret).not.toHaveBeenCalled();
      expect(repo.getById).not.toHaveBeenCalled();
    });

  it('returns null for an unknown well-formed ID without signing', async () => {
    const { service, deps } = setup(null);
    expect(await service.bootstrap(ID)).toBeNull();
    expect(deps.getProgressionSecret).not.toHaveBeenCalled();
  });

  it('fails closed for invalid versions, wrong challenge identity, missing canonical facts, or store errors', async () => {
    await expect(setup({ schemaVersion: 2, rulesetVersion: 'points-v5' }).service.bootstrap(ID))
      .rejects.toThrow('Unsupported Custom Nine');
    const altered = createCustomNineIssuedChallenge({
      ...challenge(), puzzleId: 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001',
    });
    await expect(setup(altered).service.bootstrap(ID)).rejects.toThrow('wrong challenge');
    const missing = setup();
    missing.deps.resolvePlayer.mockReturnValueOnce(null);
    await expect(missing.service.bootstrap(ID)).rejects.toThrow('player facts unavailable');
    const failed = setup();
    vi.mocked(failed.repo.getById).mockRejectedValueOnce(new Error('private-provider-key'));
    await expect(failed.service.bootstrap(ID)).rejects.toThrow('private-provider-key');
  });
});
