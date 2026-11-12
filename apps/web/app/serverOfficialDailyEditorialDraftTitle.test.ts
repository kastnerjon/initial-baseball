import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./canonicalDailyPlayerLookup', () => ({ getCanonicalDailyPlayer: vi.fn() }));
vi.mock('./materializePermanentDailyIssuedClueSnapshot', () => ({
  prepareServerOfficialDailyPublication: vi.fn(),
}));
import { renameOfficialDailyEditorialDraft } from './serverOfficialDailyEditorialDrafts';

const NOW = new Date('2026-11-10T20:00:00Z');
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const initial = {
  occurrence_id: ID, puzzle_date: '2026-11-11', puzzle_number: 199,
  edition_key: 'modern', edition_number: 2, title: 'Modern',
  selections: Array.from({ length: 9 }, (_, i) => ({
    slot: i + 1, canonicalPlayerId: 'fixture-' + (i + 1), source: 'manual',
  })),
  status: 'draft', revision: 0, created_by: 'editor',
};

/** Stateful conditional-update mock: overlapping stale writes cannot both win. */
function database(row: Record<string, unknown> | null = initial) {
  let stored = row === null ? null : structuredClone(row);
  let readError: unknown = null;
  let writeError: unknown = null;
  let response: ((row: Record<string, unknown>) => unknown) | undefined;
  let beforeWrite: (() => void) | undefined;
  const updates: Record<string, unknown>[] = [];
  const query = (patch?: Record<string, unknown>) => {
    const predicates: ((row: Record<string, unknown>) => boolean)[] = [];
    return {
      eq(key: string, value: unknown) { predicates.push(row => row[key] === value); return this; },
      gt(key: string, value: string) { predicates.push(row => String(row[key]) > value); return this; },
      select() { return this; },
      async maybeSingle() {
        if (patch) {
          beforeWrite?.();
          if (writeError !== null) return { data: null, error: writeError };
          if (!stored || !predicates.every(predicate => predicate(stored!))) {
            return { data: null, error: null };
          }
          stored = { ...stored, ...patch };
          return { data: response ? response(stored) : structuredClone(stored), error: null };
        }
        return { data: stored && predicates.every(predicate => predicate(stored!))
          ? structuredClone(stored) : null, error: readError };
      },
    };
  };
  const from = vi.fn(() => ({
    select: () => query(),
    update: (patch: Record<string, unknown>) => { updates.push(patch); return query(patch); },
  }));
  return {
    client: { from } as unknown as SupabaseClient, from, updates,
    stored: () => stored,
    failRead: (error: unknown) => { readError = error; },
    failWrite: (error: unknown) => { writeError = error; },
    corruptResponse: (fn: (row: Record<string, unknown>) => unknown) => { response = fn; },
    beforeWrite: (fn: () => void) => { beforeWrite = fn; },
    mutate: (patch: Record<string, unknown>) => { stored = { ...stored, ...patch }; },
  };
}

const rename = (db: ReturnType<typeof database>, title: unknown = '  Modern   Legends  ',
  revision = 0, now = NOW, id = ID, actor = 'trusted-editor') =>
  renameOfficialDailyEditorialDraft(db.client, id, revision, title, actor, now);

describe('private official Daily draft title revision', () => {
  it('normalizes only the title, bumps the revision and preserves the exact roster and identity', async () => {
    const db = database();
    expect(await rename(db)).toEqual({ status: 'renamed', occurrenceId: ID, revision: 1 });
    expect(db.updates).toEqual([{ title: 'Modern Legends', revision: 1,
      updated_by: 'trusted-editor', updated_at: NOW.toISOString() }]);
    expect(db.stored()).toEqual({ ...initial, ...db.updates[0] });
    expect(db.from).toHaveBeenCalledWith('official_daily_editorial_drafts');
  });

  it.each(['', 'ab', '<script>', 'bad\nname', 'x'.repeat(61), null, {}, 12])(
    'rejects invalid titles before private database access: %j', async title => {
      const db = database();
      await expect(rename(db, title)).rejects.toMatchObject({ kind: 'invalid' });
      expect(db.from).not.toHaveBeenCalled();
    },
  );

  it.each([-1, 1.5, NaN, Infinity, 2147483647, Number.MAX_SAFE_INTEGER])(
    'rejects revisions that cannot safely increment a Postgres integer: %s', async revision => {
      const db = database();
      await expect(rename(db, 'Modern Legends', revision)).rejects.toMatchObject({ kind: 'invalid' });
      expect(db.from).not.toHaveBeenCalled();
    },
  );

  it('supports the final incrementable integer revision without overflowing storage', async () => {
    const db = database({ ...initial, revision: 2147483646 });
    await expect(rename(db, 'Café Legends', 2147483646))
      .resolves.toEqual({ status: 'renamed', occurrenceId: ID, revision: 2147483647 });
  });

  it('rejects malformed IDs, empty server actors and invalid clocks without reading', async () => {
    const db = database();
    await expect(rename(db, 'Legends', 0, NOW, ID.toUpperCase()))
      .rejects.toMatchObject({ kind: 'invalid' });
    await expect(rename(db, 'Legends', 0, NOW, ID, ' '))
      .rejects.toMatchObject({ kind: 'invalid' });
    await expect(rename(db, 'Legends', 0, new Date(NaN)))
      .rejects.toMatchObject({ kind: 'invalid' });
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each([
    null, { ...initial, status: 'scheduled' }, { ...initial, status: 'issued' },
    { ...initial, revision: 1 }, { ...initial, puzzle_date: '2026-11-10', puzzle_number: 198 },
    { ...initial, puzzle_date: '2026-11-09', puzzle_number: 197 },
  ])('refuses missing, stale, scheduled, issued or nonfuture rows', async row => {
    const db = database(row);
    await expect(rename(db)).rejects.toMatchObject({ kind: 'conflict' });
    expect(db.updates).toHaveLength(0);
  });

  it('uses the Pacific date before and after midnight rather than the UTC date', async () => {
    const before = database({ ...initial, puzzle_date: '2026-11-10', puzzle_number: 198 });
    await expect(rename(before, 'Legends', 0, new Date('2026-11-10T07:59:59Z')))
      .resolves.toMatchObject({ revision: 1 });
    const after = database({ ...initial, puzzle_date: '2026-11-10', puzzle_number: 198 });
    await expect(rename(after, 'Legends', 0, new Date('2026-11-10T08:00:00Z')))
      .rejects.toMatchObject({ kind: 'conflict' });
  });

  it('allows only one of two overlapping writes to the same revision', async () => {
    const db = database();
    const results = await Promise.allSettled([rename(db, 'Modern Legends'), rename(db, 'Mixed Legends')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ kind: 'conflict' }) }),
    ]);
    expect(db.stored()).toMatchObject({ revision: 1, title: 'Modern Legends' });
    await expect(rename(db, 'Modern Legends')).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('cannot rename a row scheduled after the initial read', async () => {
    const db = database();
    db.beforeWrite(() => db.mutate({ status: 'scheduled', revision: 1 }));
    await expect(rename(db)).rejects.toMatchObject({ kind: 'conflict' });
    expect(db.stored()).toMatchObject({ status: 'scheduled', title: 'Modern' });
  });

  it.each(['read', 'write'])('redacts private provider %s failures', async phase => {
    const db = database();
    const failure = { message: 'private-player-and-provider-secret' };
    if (phase === 'read') db.failRead(failure); else db.failWrite(failure);
    await expect(rename(db)).rejects.toMatchObject({ kind: 'unavailable',
      message: 'Official Daily editorial draft could not be verified.' });
  });

  it.each([
    { title: 'wrong title' }, { revision: 7 }, { status: 'scheduled' },
    { selections: [...initial.selections].reverse() }, { edition_key: 'wrong' },
  ])('does not claim success for an inconsistent provider result: %j', async corruption => {
    const db = database();
    db.corruptResponse(row => ({ ...row, ...corruption }));
    await expect(rename(db)).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
