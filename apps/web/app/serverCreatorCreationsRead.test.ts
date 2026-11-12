import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));
import {
  CreatorCreationsReadError, isValidCreatorCreationsCursor,
  listVerifiedCreatorCreations, MAX_CREATIONS_PAGE,
} from './serverCreatorCreationsRead';

const UUID = '123e4567-e89b-42d3-a456-426614174099';
const PUZZLE = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const ISSUED = '2026-10-26T20:00:00.123456+00:00';
const row = (id = PUZZLE, date = ISSUED) =>
  ({ puzzle_id: id, display_title: 'Mets Legends', issued_at: date });
function mockDb(data: unknown, error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data, error });
  const order = vi.fn();
  const or = vi.fn();
  const eq = vi.fn();
  const chain = { eq, order, or, limit };
  eq.mockReturnValue(chain);
  or.mockReturnValue(chain);
  order.mockReturnValue(chain);
  const select = vi.fn().mockReturnValue(chain);
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, from, select, eq, order, or, limit };
}

describe('private creator My Creations keyset read', () => {
  it('projects only safe fields, scopes by verified UUID and sorts by both cursor keys', async () => {
    const db = mockDb([row()]);
    await expect(listVerifiedCreatorCreations(db.client, UUID)).resolves.toEqual({
      creations: [{ puzzleId: PUZZLE, title: 'Mets Legends', issuedAt: ISSUED }],
      nextCursor: null,
    });
    expect(db.from).toHaveBeenCalledWith('custom_nine_issued_challenges');
    expect(db.select).toHaveBeenCalledWith('puzzle_id,display_title,issued_at');
    expect(db.eq).toHaveBeenCalledWith('creator_account_id', UUID);
    expect(db.eq).toHaveBeenCalledWith('schema_version', 2);
    expect(db.order).toHaveBeenNthCalledWith(1, 'issued_at', { ascending: false });
    expect(db.order).toHaveBeenNthCalledWith(2, 'puzzle_id', { ascending: true });
    expect(db.limit).toHaveBeenCalledWith(MAX_CREATIONS_PAGE + 1);
    expect(db.or).not.toHaveBeenCalled();
  });

  it('returns a compound cursor after 40 entries, retaining precision and tie ordering', async () => {
    const rows = Array.from({ length: 41 }, (_, i) => row(
      'custom-lineup-v2-123e4567-e89b-42d3-a456-' + i.toString(16).padStart(12, '0'),
    ));
    const db = mockDb(rows);
    const page = await listVerifiedCreatorCreations(db.client, UUID);
    expect(page.creations).toHaveLength(40);
    expect(page.nextCursor).toBe(ISSUED + '|' + rows[39]?.puzzle_id);
    expect(page.creations.some(item => item.puzzleId === rows[40]?.puzzle_id)).toBe(false);
    const older = mockDb([rows[40]]);
    await expect(listVerifiedCreatorCreations(older.client, UUID, page.nextCursor)).resolves.toEqual({
      creations: [{ puzzleId: rows[40]?.puzzle_id, title: 'Mets Legends', issuedAt: ISSUED }],
      nextCursor: null,
    });
    const [date, puzzle] = page.nextCursor!.split('|');
    expect(older.or).toHaveBeenCalledWith('issued_at.lt.' + date
      + ',and(issued_at.eq.' + date + ',puzzle_id.gt.' + puzzle + ')');
  });

  it('returns no cursor for an empty or final short page', async () => {
    await expect(listVerifiedCreatorCreations(mockDb([]).client, UUID))
      .resolves.toEqual({ creations: [], nextCursor: null });
  });

  it('rejects malicious and malformed cursors before querying service-role data', async () => {
    const db = mockDb([]);
    for (const cursor of [
      '', 'invalid', ISSUED + '|other',
      ISSUED + ',creator_account_id.eq.other|' + PUZZLE,
      ISSUED + '|' + PUZZLE + '|extra',
      '2026-10-26T20:00:00Z)|' + PUZZLE,
      'x'.repeat(500),
    ]) {
      expect(isValidCreatorCreationsCursor(cursor)).toBe(false);
      await expect(listVerifiedCreatorCreations(db.client, UUID, cursor))
        .rejects.toBeInstanceOf(CreatorCreationsReadError);
    }
    expect(isValidCreatorCreationsCursor(ISSUED + '|' + PUZZLE)).toBe(true);
    await expect(listVerifiedCreatorCreations(db.client, 'attacker@example.test'))
      .rejects.toBeInstanceOf(CreatorCreationsReadError);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('fails closed for corrupt rows and provider errors without leaking private fields', async () => {
    for (const bad of [
      row('other'), { ...row(), display_title: '<script>' },
      row(PUZZLE, 'invalid'), row(PUZZLE, '2026-10-26T20:00:00Z,other.eq.a'),
    ]) {
      await expect(listVerifiedCreatorCreations(mockDb([bad]).client, UUID))
        .rejects.toBeInstanceOf(CreatorCreationsReadError);
    }
    await expect(listVerifiedCreatorCreations(mockDb(null, { message: 'private SQL' }).client, UUID))
      .rejects.toThrow('Creator creations unavailable.');
  });
});
