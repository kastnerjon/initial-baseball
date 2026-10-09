import {
  createCustomNineIssuedChallengeService,
  createPermanentDailyIssuedClueSnapshot,
  type CustomNineIssuedChallengeRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createServerCustomNineCreationService, ServerCustomNineCreationError } from './serverCustomNineCreation';

const IDS = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);
const UUID = '123e4567-e89b-42d3-a456-426614174000';
const PUZZLE_ID = `custom-nine-v1-${UUID}`;
const DATE = '2026-10-09T15:00:00.000Z';
const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private-key' };

function setup() {
  const client = {} as SupabaseClient;
  const repository: CustomNineIssuedChallengeRepository = {
    insertIfAbsent: vi.fn(async challenge => ({ status: 'inserted' as const, challenge })),
    getById: vi.fn(async () => null),
  };
  const snapshot = createPermanentDailyIssuedClueSnapshot({
    hintLayout: [
      { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
      { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
      { slot: 3, hintType: 'position', displayLabel: 'Position' },
      { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
    ],
    pitches: IDS.map((canonicalPlayerId, index) => ({
      pitchNumber: index + 1,
      canonicalPlayerId,
      initials: `P${index + 1}`,
      hintValues: ['2000s', 'NYM', 'SS', 'HR 123'],
    })),
  });
  const dependencies = {
    createSupabaseClient: vi.fn((_environment: Record<string, string | undefined>) => client),
    createRepository: vi.fn((_client: SupabaseClient) => repository),
    materializeClues: vi.fn((_ids: readonly string[]) => snapshot),
    mintUuid: vi.fn(() => UUID),
    issuedAt: vi.fn(() => DATE),
  };
  const service = createServerCustomNineCreationService({ environment: ENV, dependencies });
  return { service, repository, dependencies, snapshot, client };
}

describe('server-only Custom Nine challenge creation', () => {
  it('validates nine player IDs, freezes canonical ordered hints, and returns only an opaque ID', async () => {
    const { service, repository, dependencies, client } = setup();
    const result = await service.issue({ canonicalPlayerIds: [...IDS] });
    expect(result).toEqual({ puzzleId: PUZZLE_ID });
    expect(Object.keys(result)).toEqual(['puzzleId']);
    expect(dependencies.materializeClues).toHaveBeenCalledWith(IDS);
    expect(dependencies.createSupabaseClient).toHaveBeenCalledWith(ENV);
    expect(dependencies.createRepository).toHaveBeenCalledWith(client);
    const stored = vi.mocked(repository.insertIfAbsent).mock.calls[0]?.[0];
    expect(stored).toMatchObject({
      schemaVersion: 1, puzzleId: PUZZLE_ID, rulesetVersion: 'points-v4',
      canonicalPlayerIds: IDS, issuedAt: DATE,
      clueSnapshot: { pitches: expect.arrayContaining([
        expect.objectContaining({ canonicalPlayerId: 'player-1', hintValues: ['2000s', 'NYM', 'SS', 'HR 123'] }),
      ]) },
    });
    expect(Object.isFrozen(stored?.clueSnapshot.pitches[0]?.hintValues)).toBe(true);
    expect(repository.insertIfAbsent).toHaveBeenCalledTimes(1);
  });

  it.each([
    [null], [[]], [{ canonicalPlayerIds: IDS.slice(0, 8) }],
    [{ canonicalPlayerIds: [...IDS.slice(0, 8), IDS[0]] }],
    [{ canonicalPlayerIds: IDS.map((id, i) => i === 0 ? ' ' + id : id) }],
    [{ canonicalPlayerIds: [...IDS.slice(0, 8), 5] }],
    [{ canonicalPlayerIds: IDS, creatorIsExcluded: true }],
    [{ canonicalPlayerIds: IDS, puzzleId: PUZZLE_ID }],
  ])('rejects malformed or attacker-controlled request %j before materialization or persistence', async payload => {
    const { service, dependencies, repository } = setup();
    await expect(service.issue(payload)).rejects.toMatchObject({
      kind: 'invalid_selection',
    });
    expect(dependencies.materializeClues).not.toHaveBeenCalled();
    expect(dependencies.createSupabaseClient).not.toHaveBeenCalled();
    expect(repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('does not leak private IDs or hints when canonical lookup fails', async () => {
    const { service, dependencies } = setup();
    const secret = 'private-canonical-player-12345';
    dependencies.materializeClues.mockImplementationOnce(() => {
      throw new Error(`Missing ${secret} future secret hint`);
    });
    let caught: unknown;
    try { await service.issue({ canonicalPlayerIds: IDS }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(ServerCustomNineCreationError);
    expect(caught).toMatchObject({ kind: 'unsupported_players' });
    expect(String(caught)).not.toContain(secret);
    expect(dependencies.createSupabaseClient).not.toHaveBeenCalled();
  });

  it('maps immutable ID conflicts without reading or revealing the stored challenge', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.insertIfAbsent).mockResolvedValueOnce({
      status: 'existing', challenge: { schemaVersion: 2, rulesetVersion: 'points-v5' },
    });
    await expect(service.issue({ canonicalPlayerIds: IDS }))
      .rejects.toMatchObject({ kind: 'immutable_conflict' });
    expect(repository.getById).not.toHaveBeenCalled();
  });

  it('propagates provider failures only to the sanitizing HTTP boundary', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.insertIfAbsent).mockRejectedValueOnce(new Error('private-supabase-key'));
    await expect(service.issue({ canonicalPlayerIds: IDS })).rejects.toThrow('private-supabase-key');
  });
});
