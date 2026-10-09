import {
  createCustomNineIssuedChallenge,
  createCustomNineIssuedChallengeService,
  createPermanentDailyIssuedClueSnapshot,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  decodeCustomNineIssuedChallengeRow,
  encodeCustomNineIssuedChallengeRow,
} from './supabaseCustomNineIssuedChallengeRowCodec';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';

const PUZZLE_ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const SECOND_ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const PLAYER_IDS = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);
const CHALLENGE = makeChallenge();

describe('private Custom Nine Supabase row codec', () => {
  it('round-trips a frozen ordered nine and all four hints without sharing mutable arrays', () => {
    const encoded = encodeCustomNineIssuedChallengeRow(CHALLENGE);
    expect(encoded).toMatchObject({
      puzzle_id: PUZZLE_ID,
      schema_version: 1,
      ruleset_version: 'points-v4',
      canonical_player_ids: PLAYER_IDS,
      issued_at: CHALLENGE.issuedAt,
    });
    const decoded = decodeCustomNineIssuedChallengeRow(encoded);
    expect(decoded).toEqual(CHALLENGE);
    expect(Object.isFrozen(decoded.clueSnapshot.pitches[0].hintValues)).toBe(true);
    encoded.canonical_player_ids[0] = 'changed';
    expect(CHALLENGE.canonicalPlayerIds[0]).toBe('player-1');
    expect(decoded.canonicalPlayerIds[0]).toBe('player-1');
  });

  it.each([
    ['unrecognized schema', { schema_version: 2 }],
    ['unrecognized ruleset', { ruleset_version: 'points-v5' }],
    ['invalid ID', { puzzle_id: 'predictable-name' }],
    ['duplicate players', { canonical_player_ids: Array(9).fill('player-1') }],
    ['missing players', { canonical_player_ids: PLAYER_IDS.slice(0, 8) }],
    ['missing clues', { clue_snapshot: null }],
    ['incomplete clues', { clue_snapshot: { ...CHALLENGE.clueSnapshot, pitches: CHALLENGE.clueSnapshot.pitches.slice(0, 8) } }],
    ['misordered clues', { clue_snapshot: { ...CHALLENGE.clueSnapshot, pitches: [...CHALLENGE.clueSnapshot.pitches].reverse() } }],
    ['invalid timestamp', { issued_at: 'invalid timestamp' }],
  ])('rejects %s', (_label, change) => {
    expect(() => decodeCustomNineIssuedChallengeRow({
      ...encodeCustomNineIssuedChallengeRow(CHALLENGE),
      ...change,
    })).toThrowError(expect.objectContaining({ kind: 'invalid-row' }));
  });

  it('rejects absent and partial returned rows', () => {
    expect(() => decodeCustomNineIssuedChallengeRow(null)).toThrowError(
      expect.objectContaining({ kind: 'invalid-row' }),
    );
    expect(() => decodeCustomNineIssuedChallengeRow({ puzzle_id: PUZZLE_ID }))
      .toThrowError(expect.objectContaining({ kind: 'invalid-row' }));
  });
});

describe('private Custom Nine Supabase repository', () => {
  it('uses only INSERT/SELECT and returns the validated inserted record', async () => {
    const { client, insert, selectInsert } = insertClient(
      encodeCustomNineIssuedChallengeRow(CHALLENGE),
    );
    const repository = createSupabaseCustomNineIssuedChallengeRepository(client);
    await expect(repository.insertIfAbsent(CHALLENGE))
      .resolves.toEqual({ status: 'inserted', challenge: CHALLENGE });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      puzzle_id: PUZZLE_ID,
      schema_version: 1,
      ruleset_version: 'points-v4',
    }));
    expect(selectInsert).toHaveBeenCalledWith(expect.stringContaining('clue_snapshot'));
  });

  it('rereads the immutable PK winner on 23505 without updating it', async () => {
    const winner = makeChallenge('2026-10-09T01:00:00.000Z');
    const { client, match } = insertClient(null, { code: '23505' }, encodeCustomNineIssuedChallengeRow(winner));
    const repository = createSupabaseCustomNineIssuedChallengeRepository(client);
    await expect(repository.insertIfAbsent(CHALLENGE))
      .resolves.toEqual({ status: 'existing', challenge: winner });
    expect(match).toHaveBeenCalledWith({ puzzle_id: PUZZLE_ID });
    await expect(createCustomNineIssuedChallengeService(repository).getById('not-an-id'))
      .rejects.toThrow('Invalid Custom Nine puzzle ID');
  });

  it('rejects an immutable collision through the existing portable service', async () => {
    const winner = makeChallenge('2026-10-09T01:00:00.000Z', [...PLAYER_IDS].reverse());
    const { client } = insertClient(null, { code: '23505' }, encodeCustomNineIssuedChallengeRow(winner));
    const service = createCustomNineIssuedChallengeService(
      createSupabaseCustomNineIssuedChallengeRepository(client),
    );
    await expect(service.issue(makeInput())).resolves.toEqual({ ok: false, error: 'immutable_conflict' });
  });

  it('returns null for missing private reads and filters by exact puzzle ID', async () => {
    const { client, match } = readClient(null);
    await expect(createSupabaseCustomNineIssuedChallengeRepository(client).getById(PUZZLE_ID))
      .resolves.toBeNull();
    expect(match).toHaveBeenCalledWith({ puzzle_id: PUZZLE_ID });
  });

  it('rejects invalid IDs before querying Supabase', async () => {
    const from = vi.fn();
    const repository = createSupabaseCustomNineIssuedChallengeRepository(asClient(from));
    await expect(repository.getById('custom-nine-v1-not-uuid')).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects a different ID returned for either an insert or a read', async () => {
    const wrong = encodeCustomNineIssuedChallengeRow(makeChallenge(
      '2026-10-09T01:00:00.000Z',
      PLAYER_IDS,
      SECOND_ID,
    ));
    await expect(createSupabaseCustomNineIssuedChallengeRepository(
      insertClient(wrong).client,
    ).insertIfAbsent(CHALLENGE)).rejects.toMatchObject({ kind: 'invalid-row' });
    await expect(createSupabaseCustomNineIssuedChallengeRepository(
      readClient(wrong).client,
    ).getById(PUZZLE_ID)).rejects.toMatchObject({ kind: 'invalid-row' });
  });

  it('fails closed when a conflict winner disappears or is malformed', async () => {
    await expect(createSupabaseCustomNineIssuedChallengeRepository(
      insertClient(null, { code: '23505' }, null).client,
    ).insertIfAbsent(CHALLENGE)).rejects.toMatchObject({ kind: 'query' });
    await expect(createSupabaseCustomNineIssuedChallengeRepository(
      insertClient(null, { code: '23505' }, { puzzle_id: PUZZLE_ID }).client,
    ).insertIfAbsent(CHALLENGE)).rejects.toMatchObject({ kind: 'invalid-row' });
  });

  it('fails closed for nonunique provider errors and thrown transport failures', async () => {
    await expect(createSupabaseCustomNineIssuedChallengeRepository(
      insertClient(null, { code: '08006' }).client,
    ).insertIfAbsent(CHALLENGE)).rejects.toMatchObject({ kind: 'query' });
    await expect(createSupabaseCustomNineIssuedChallengeRepository(
      readClient(null, { code: '08006' }).client,
    ).getById(PUZZLE_ID)).rejects.toMatchObject({ kind: 'query' });
    const broken = asClient(vi.fn().mockImplementation(() => { throw new Error('private provider error'); }));
    await expect(createSupabaseCustomNineIssuedChallengeRepository(broken)
      .getById(PUZZLE_ID)).rejects.toMatchObject({
      kind: 'query',
      message: expect.not.stringContaining('private provider error'),
    });
  });
});

function makeInput(issuedAt = '2026-10-08T23:45:00-04:00', ids = PLAYER_IDS, puzzleId = PUZZLE_ID) {
  return {
    puzzleId,
    canonicalPlayerIds: [...ids],
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1 as const, hintType: 'main_decade' as const, displayLabel: 'Main decade' },
        { slot: 2 as const, hintType: 'teams' as const, displayLabel: 'Teams' },
        { slot: 3 as const, hintType: 'position' as const, displayLabel: 'Position' },
        { slot: 4 as const, hintType: 'stats' as const, displayLabel: 'Stats' },
      ],
      pitches: ids.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1,
        canonicalPlayerId,
        initials: `P${index + 1}`,
        hintValues: ['2000s', 'Mets', 'SS', 'HR 123'],
      })),
    }),
    issuedAt,
  };
}

function makeChallenge(issuedAt?: string, ids = PLAYER_IDS, puzzleId = PUZZLE_ID) {
  return createCustomNineIssuedChallenge(makeInput(issuedAt, ids, puzzleId));
}

function insertClient(
  data: unknown,
  error: { code: string } | null = null,
  winner: unknown = null,
) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const selectInsert = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select: selectInsert });
  const maybeSingle = vi.fn().mockResolvedValue({ data: winner, error: null });
  const match = vi.fn().mockReturnValue({ maybeSingle });
  const from = vi.fn()
    .mockReturnValueOnce({ insert })
    .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ match }) });
  return { client: asClient(from), insert, selectInsert, match };
}

function readClient(data: unknown, error: { code: string } | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const match = vi.fn().mockReturnValue({ maybeSingle });
  const from = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ match }) });
  return { client: asClient(from), match };
}

function asClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}
