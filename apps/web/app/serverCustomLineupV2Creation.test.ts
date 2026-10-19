import { createHash } from 'node:crypto';
import {
  createCustomLineupIssuedClueSnapshot,
  type CustomLineupIssuedChallenge,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import {
  createServerCustomLineupV2CreationService,
} from './serverCustomLineupV2Creation';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const DATE = '2026-10-15T20:00:00.000Z';
const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private' };
const players = (n: number) => Array.from({ length: n }, (_, i) => 'player-' + (i + 1));

function clueSnapshot(ids: readonly string[]) {
  return createCustomLineupIssuedClueSnapshot({
    hintLayout: [
      { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
      { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
      { slot: 3, hintType: 'position', displayLabel: 'Position' },
      { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
    ],
    pitches: ids.map((canonicalPlayerId, index) => ({
      pitchNumber: index + 1, canonicalPlayerId, initials: 'P' + (index + 1),
      hintValues: ['2000s', 'NYM', 'SS', 'HR 300'],
    })),
  });
}

function setup() {
  const client = {} as SupabaseClient;
  const insertIfAbsent = vi.fn(async (challenge: CustomLineupIssuedChallenge): Promise<{
    status: 'inserted' | 'existing'; challenge: CustomLineupIssuedChallenge;
  }> => ({ status: 'inserted', challenge }));
  const dependencies = {
    createSupabaseClient: vi.fn(() => client),
    createRepository: vi.fn(() => ({ insertIfAbsent })),
    materializeClues: vi.fn((ids: readonly string[]) => clueSnapshot(ids)),
    mintUuid: vi.fn(() => '123e4567-e89b-42d3-a456-426614174000'),
    issuedAt: vi.fn(() => DATE),
    mintOwnerCapability: vi.fn(() => 'A'.repeat(43)),
  };
  const service = createServerCustomLineupV2CreationService({ environment: ENV, dependencies });
  return { service, insertIfAbsent, dependencies };
}

describe('private Custom Lineup v2 issuance', () => {
  it.each([1, 5, 9, 10])('freezes exactly %i ordered canonical batters and returns only an opaque ID', async n => {
    const { service, insertIfAbsent, dependencies } = setup();
    const ids = players(n).reverse();
    const result = await service.issue({ canonicalPlayerIds: ids });
    expect(result).toEqual({ puzzleId: ID });
    expect(Object.keys(result)).toEqual(['puzzleId']);
    const stored = insertIfAbsent.mock.calls[0]?.[0];
    expect(stored).toMatchObject({
      schemaVersion: 2, rulesetVersion: 'points-v4', puzzleId: ID,
      issuedAt: DATE, canonicalPlayerIds: ids,
    });
    expect(stored?.clueSnapshot.pitches.map(p => p.canonicalPlayerId)).toEqual(ids);
    expect(Object.isFrozen(stored?.clueSnapshot.pitches[0]?.hintValues)).toBe(true);
    expect(dependencies.materializeClues).toHaveBeenCalledWith(ids);
    expect(dependencies.createRepository).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('HR 300');
    expect(JSON.stringify(result)).not.toContain('player-');
  });

  it('persists a normalized title with issuance, but keeps the answer-free response', async () => {
    const { service, insertIfAbsent } = setup();
    const result = await service.issue({ canonicalPlayerIds: players(1) }, '  Mets   Legends  ');
    expect(result).toEqual({ puzzleId: ID });
    expect(insertIfAbsent).toHaveBeenCalledWith(expect.anything(), 'Mets Legends');
    expect(JSON.stringify(result)).not.toContain('Mets');
  });

  it('creates a separate random owner management code and stores only its digest', async () => {
    const { service, insertIfAbsent, dependencies } = setup();
    const response = await service.issueAnonymous({ canonicalPlayerIds: players(2) },
      '  Subway   Series ');
    expect(response).toEqual({ puzzleId: ID, ownerCapability: 'A'.repeat(43) });
    const digest = createHash('sha256').update(response.ownerCapability).digest('hex');
    expect(insertIfAbsent).toHaveBeenCalledWith(expect.anything(), 'Subway Series', digest);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(response.ownerCapability);
    expect(dependencies.mintOwnerCapability).toHaveBeenCalledOnce();
    const old = await service.issue({ canonicalPlayerIds: players(1) });
    expect(old).toEqual({ puzzleId: ID });
    expect(insertIfAbsent).toHaveBeenLastCalledWith(expect.anything(), undefined);
    expect(dependencies.mintOwnerCapability).toHaveBeenCalledOnce();
  });

  it('fails closed when owner code generation is malformed or insert collides', async () => {
    const { service, insertIfAbsent, dependencies } = setup();
    dependencies.mintOwnerCapability.mockReturnValueOnce('short');
    await expect(service.issueAnonymous({canonicalPlayerIds: players(1)}, 'Valid Title'))
      .rejects.toThrow();
    expect(insertIfAbsent).not.toHaveBeenCalled();
    insertIfAbsent.mockResolvedValueOnce({ status: 'existing',
      challenge: {} as CustomLineupIssuedChallenge });
    await expect(service.issueAnonymous({ canonicalPlayerIds: players(1)}, 'Valid Title'))
      .rejects.toMatchObject({ kind: 'immutable_conflict' });
  });

  it('refuses malformed titles before player materialization or storage', async () => {
    for (const title of ['', 'a', '<img>', '\uFE0F\uFE0F\uFE0F', 'x'.repeat(61)]) {
      const { service, dependencies } = setup();
      await expect(service.issue({ canonicalPlayerIds: players(1) }, title))
        .rejects.toMatchObject({ kind: 'invalid_selection' });
      expect(dependencies.materializeClues).not.toHaveBeenCalled();
      expect(dependencies.createSupabaseClient).not.toHaveBeenCalled();
    }
  });

  it.each([
    null, [], {}, { canonicalPlayerIds: [] },
    { canonicalPlayerIds: players(11) },
    { canonicalPlayerIds: ['player-1', 'player-1'] },
    { canonicalPlayerIds: [' player-1'] },
    { canonicalPlayerIds: [15] },
    { canonicalPlayerIds: players(1), rulesetVersion: 'points-v4' },
  ])('rejects invalid selection %j before touching player catalog or storage', async payload => {
    const { service, dependencies } = setup();
    await expect(service.issue(payload)).rejects.toMatchObject({ kind: 'invalid_selection' });
    expect(dependencies.materializeClues).not.toHaveBeenCalled();
    expect(dependencies.createSupabaseClient).not.toHaveBeenCalled();
  });

  it('hides lookup and clue errors without writing records', async () => {
    const { service, dependencies } = setup();
    dependencies.materializeClues.mockImplementationOnce(() => {
      throw new Error('unreleased canonical-player-42 hint');
    });
    await expect(service.issue({ canonicalPlayerIds: players(1) }))
      .rejects.toMatchObject({ kind: 'unsupported_players',
        message: expect.not.stringContaining('canonical-player-42') });
    expect(dependencies.createRepository).not.toHaveBeenCalled();
  });

  it('refuses missing hints, contradictory frozen identities and immutable collisions', async () => {
    const { service, dependencies, insertIfAbsent } = setup();
    dependencies.materializeClues.mockReturnValueOnce(clueSnapshot(['another-player']));
    await expect(service.issue({ canonicalPlayerIds: players(1) }))
      .rejects.toMatchObject({ kind: 'unsupported_players' });
    expect(insertIfAbsent).not.toHaveBeenCalled();
    insertIfAbsent.mockImplementationOnce(async challenge => ({ status: 'existing' as const, challenge }));
    await expect(service.issue({ canonicalPlayerIds: players(1) }))
      .rejects.toMatchObject({ kind: 'immutable_conflict' });
  });

  it('rejects storage mutation and does not surface provider internals in the success payload', async () => {
    const { service, insertIfAbsent } = setup();
    insertIfAbsent.mockImplementationOnce(async challenge => ({
      status: 'inserted' as const,
      challenge: { ...challenge, issuedAt: '2026-10-15T21:00:00.000Z' },
    }));
    await expect(service.issue({ canonicalPlayerIds: players(1) }))
      .rejects.toMatchObject({ kind: 'immutable_conflict' });
  });
});
