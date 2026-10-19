import {
  createCustomLineupIssuedChallenge, createCustomLineupIssuedClueSnapshot,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  createSupabaseCustomLineupV2IssuedWriter, encodeCustomLineupV2IssuedRow,
} from './supabaseCustomLineupV2IssuedWriter';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
function challenge(n: number) {
  const canonicalPlayerIds = Array.from({ length: n }, (_, i) => 'player-' + (i + 1));
  return createCustomLineupIssuedChallenge({
    puzzleId: ID, canonicalPlayerIds, issuedAt: '2026-10-15T20:00:00.000Z',
    clueSnapshot: createCustomLineupIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: canonicalPlayerIds.map((canonicalPlayerId, i) => ({
        pitchNumber: i + 1, canonicalPlayerId, initials: 'P' + (i + 1),
        hintValues: ['2000s', 'Mets', 'SS', 'HR 200'],
      })),
    }),
  });
}
function clientForInsert(data: unknown, error: { code: string } | null = null, winner: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
  const match = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: winner, error: null }) });
  const readSelect = vi.fn().mockReturnValue({ match });
  const from = vi.fn()
    .mockReturnValueOnce({ insert })
    .mockReturnValueOnce({ select: readSelect });
  return { client: { from } as unknown as SupabaseClient, insert, match };
}

describe('named immutable writer', () => {
  it('writes an optional title on the exact same row insert, never on a second write', async () => {
    const issued = challenge(3);
    const { client, insert } = clientForInsert(encodeCustomLineupV2IssuedRow(issued));
    const result = await createSupabaseCustomLineupV2IssuedWriter(client)
      .insertIfAbsent(issued, 'Mets Legends');
    expect(result.status).toBe('inserted');
    expect(insert).toHaveBeenCalledWith({
      ...encodeCustomLineupV2IssuedRow(issued),
      display_title: 'Mets Legends',
    });
  });
});

describe('private version-2 immutable writer', () => {
  it.each([1, 5, 9, 10])('inserts a schema-2 %i-player snapshot without changing the input', async n => {
    const expected = challenge(n);
    const row = encodeCustomLineupV2IssuedRow(expected);
    const { client, insert } = clientForInsert(row);
    await expect(createSupabaseCustomLineupV2IssuedWriter(client).insertIfAbsent(expected))
      .resolves.toEqual({ status: 'inserted', challenge: expected });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      schema_version: 2, ruleset_version: 'points-v4',
      canonical_player_ids: expected.canonicalPlayerIds,
      clue_snapshot: expect.objectContaining({
        pitches: expect.arrayContaining([expect.objectContaining({ canonicalPlayerId: 'player-1' })]),
      }),
    }));
    row.canonical_player_ids[0] = 'corrupted-after-insert';
    expect(expected.canonicalPlayerIds[0]).toBe('player-1');
  });

  it('rereads a duplicate ID without an upsert, update or cross-version reinterpretation', async () => {
    const requested = challenge(1);
    const winner = encodeCustomLineupV2IssuedRow(challenge(5));
    const { client, insert, match } = clientForInsert(null, { code: '23505' }, winner);
    await expect(createSupabaseCustomLineupV2IssuedWriter(client).insertIfAbsent(requested))
      .resolves.toEqual({ status: 'existing', challenge: challenge(5) });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(match).toHaveBeenCalledWith({ puzzle_id: ID, schema_version: 2 });
  });

  it('fails closed on missing or invalid stored rows and provider failure', async () => {
    const requested = challenge(1);
    const mismatch = { ...encodeCustomLineupV2IssuedRow(requested), puzzle_id: ID.replace(/.$/, '1') };
    await expect(createSupabaseCustomLineupV2IssuedWriter(clientForInsert(mismatch).client)
      .insertIfAbsent(requested)).rejects.toMatchObject({ kind: 'invalid-row' });
    await expect(createSupabaseCustomLineupV2IssuedWriter(clientForInsert(null).client)
      .insertIfAbsent(requested)).rejects.toMatchObject({ kind: 'invalid-row' });
    await expect(createSupabaseCustomLineupV2IssuedWriter(clientForInsert(null, { code: '23505' }).client)
      .insertIfAbsent(requested)).rejects.toMatchObject({ kind: 'query' });
    await expect(createSupabaseCustomLineupV2IssuedWriter(clientForInsert(null, { code: '08006' }).client)
      .insertIfAbsent(requested)).rejects.toMatchObject({ kind: 'query' });
  });
});
