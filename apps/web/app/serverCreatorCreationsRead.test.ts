import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));
import { CreatorCreationsReadError, listVerifiedCreatorCreations, MAX_CREATIONS_PAGE } from './serverCreatorCreationsRead';

const UUID = '123e4567-e89b-42d3-a456-426614174099';
const PUZZLE = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
function mockDb(data: unknown, error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data, error });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn();
  eq.mockReturnValue({ eq, order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, from, select, eq, order, limit };
}

describe('private creator My Creations read model', () => {
  it('selects only safe fields and scopes by exact verified UUID, schema and newest-first limit', async () => {
    const row = { puzzle_id: PUZZLE, display_title: 'Mets Legends', issued_at: '2026-10-26T20:00:00Z' };
    const db = mockDb([row]);
    await expect(listVerifiedCreatorCreations(db.client, UUID)).resolves.toEqual([{
      puzzleId: PUZZLE, title: 'Mets Legends', issuedAt: row.issued_at,
    }]);
    expect(db.from).toHaveBeenCalledWith('custom_nine_issued_challenges');
    expect(db.select).toHaveBeenCalledWith('puzzle_id,display_title,issued_at');
    expect(db.eq).toHaveBeenCalledWith('creator_account_id', UUID);
    expect(db.eq).toHaveBeenCalledWith('schema_version', 2);
    expect(db.order).toHaveBeenCalledWith('issued_at', { ascending: false });
    expect(db.limit).toHaveBeenCalledWith(MAX_CREATIONS_PAGE);
    expect(JSON.stringify(row)).not.toContain('canonical_player_ids');
  });

  it('returns an empty list for verified new accounts with no creations', async () => {
    await expect(listVerifiedCreatorCreations(mockDb([]).client, UUID)).resolves.toEqual([]);
  });

  it('rejects invalid account IDs before any service-role query', async () => {
    const db = mockDb([]);
    await expect(listVerifiedCreatorCreations(db.client, 'attacker@example.test'))
      .rejects.toBeInstanceOf(CreatorCreationsReadError);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('fails closed for corrupt rows or provider errors without leaking DB or secret fields', async () => {
    for (const row of [
      { puzzle_id: 'other', display_title: 'Valid Name', issued_at: '2026-10-26T20:00:00Z' },
      { puzzle_id: PUZZLE, display_title: '<script>', issued_at: '2026-10-26T20:00:00Z' },
      { puzzle_id: PUZZLE, display_title: 'Valid Name', issued_at: 'invalid' },
    ]) await expect(listVerifiedCreatorCreations(mockDb([row]).client, UUID))
      .rejects.toBeInstanceOf(CreatorCreationsReadError);
    await expect(listVerifiedCreatorCreations(mockDb(null, { message: 'private SQL' }).client, UUID))
      .rejects.toThrow('Creator creations unavailable.');
  });
});
