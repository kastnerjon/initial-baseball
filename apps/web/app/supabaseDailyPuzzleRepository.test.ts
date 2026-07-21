import {
  createDailyPuzzleDraft,
  getDailyPuzzleNumber,
  scheduleDailyPuzzle,
  type DailyPuzzleEditorialRecord,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  SupabaseDailyPuzzleRepositoryError,
  createSupabaseDailyPuzzleRepository,
} from './supabaseDailyPuzzleRepository';

const PUZZLE_DATE = '2026-08-01';
const CREATED_AT = '2026-07-21T14:00:00.000Z';
const SCHEDULED_AT = '2026-07-21T15:00:00.000Z';
const COLUMNS = expect.stringContaining('puzzle_date');

describe('Supabase Daily puzzle repository', () => {
  it('reads one persisted puzzle and decodes its canonical selections', async () => {
    const record = buildDraft();
    const maybeSingle = vi.fn().mockResolvedValue({ data: toRow(record), error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const result = await createSupabaseDailyPuzzleRepository(asClient(from)).getByDate(PUZZLE_DATE);

    expect(result).toEqual(record);
    expect(from).toHaveBeenCalledWith('daily_editorial_puzzles');
    expect(select).toHaveBeenCalledWith(COLUMNS);
    expect(eq).toHaveBeenCalledWith('puzzle_date', PUZZLE_DATE);
  });

  it('uses an inclusive date query and returns chronological results defensively', async () => {
    const first = buildDraft('2026-08-01');
    const second = buildDraft('2026-08-02');
    const order = vi.fn().mockResolvedValue({ data: [toRow(second), toRow(first)], error: null });
    const lte = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ lte });
    const select = vi.fn().mockReturnValue({ gte });

    const result = await createSupabaseDailyPuzzleRepository(asClient(
      vi.fn().mockReturnValue({ select }),
    )).listByDateRange(first.puzzleDate, second.puzzleDate);

    expect(result.map(record => record.puzzleDate)).toEqual([first.puzzleDate, second.puzzleDate]);
    expect(gte).toHaveBeenCalledWith('puzzle_date', first.puzzleDate);
    expect(lte).toHaveBeenCalledWith('puzzle_date', second.puzzleDate);
    expect(order).toHaveBeenCalledWith('puzzle_date', { ascending: true });
  });

  it('inserts a revision-zero record when no prior revision is expected', async () => {
    const record = buildDraft();
    const single = vi.fn().mockResolvedValue({ data: toRow(record), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });

    const result = await createSupabaseDailyPuzzleRepository(asClient(
      vi.fn().mockReturnValue({ insert }),
    )).save(record, { expectedRevision: null });

    expect(result).toEqual(record);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: record.id,
      puzzle_date: record.puzzleDate,
      revision: 0,
      selections: record.selections,
    }));
  });

  it('updates by date and expected revision without rewriting immutable identity fields', async () => {
    const scheduled = scheduleDailyPuzzle(buildDraft(), {
      actorId: 'editor-2',
      occurredAt: SCHEDULED_AT,
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: toRow(scheduled), error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const secondEq = vi.fn().mockReturnValue({ select });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const update = vi.fn().mockReturnValue({ eq: firstEq });

    const result = await createSupabaseDailyPuzzleRepository(asClient(
      vi.fn().mockReturnValue({ update }),
    )).save(scheduled, { expectedRevision: 0 });

    expect(result).toEqual(scheduled);
    const updateRow = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateRow).toMatchObject({ revision: 1, status: 'scheduled' });
    expect(updateRow).not.toHaveProperty('id');
    expect(updateRow).not.toHaveProperty('puzzle_date');
    expect(updateRow).not.toHaveProperty('created_at');
    expect(firstEq).toHaveBeenCalledWith('puzzle_date', PUZZLE_DATE);
    expect(secondEq).toHaveBeenCalledWith('revision', 0);
  });

  it('reports a stale optimistic update as a conflict', async () => {
    const scheduled = scheduleDailyPuzzle(buildDraft(), {
      actorId: 'editor-2',
      occurredAt: SCHEDULED_AT,
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const secondEq = vi.fn().mockReturnValue({ select });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const update = vi.fn().mockReturnValue({ eq: firstEq });

    await expect(createSupabaseDailyPuzzleRepository(asClient(
      vi.fn().mockReturnValue({ update }),
    )).save(scheduled, { expectedRevision: 0 })).rejects.toMatchObject({
      kind: 'conflict',
    });
  });

  it('maps a duplicate-date insert violation to a conflict', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });

    await expect(createSupabaseDailyPuzzleRepository(asClient(
      vi.fn().mockReturnValue({ insert }),
    )).save(buildDraft(), { expectedRevision: null })).rejects.toMatchObject({
      kind: 'conflict',
    });
  });

  it('rejects malformed persisted selections instead of inventing domain data', async () => {
    const row = toRow(buildDraft());
    row.selections = (row.selections as Array<Record<string, unknown>>).map((selection, index) => (
      index === 1 ? { ...selection, canonicalPlayerId: 'player-1' } : selection
    ));
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });

    await expect(createSupabaseDailyPuzzleRepository(asClient(
      vi.fn().mockReturnValue({ select }),
    )).getByDate(PUZZLE_DATE)).rejects.toMatchObject({
      kind: 'invalid-row',
    });
  });

  it('rejects skipped revisions before issuing a database query', async () => {
    const from = vi.fn();
    const skippedRevision = { ...buildDraft(), revision: 2 };

    await expect(createSupabaseDailyPuzzleRepository(asClient(from)).save(
      skippedRevision,
      { expectedRevision: 0 },
    )).rejects.toBeInstanceOf(SupabaseDailyPuzzleRepositoryError);
    expect(from).not.toHaveBeenCalled();
  });

  it('maps provider failures to a query error without leaking provider behavior upward', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });

    await expect(createSupabaseDailyPuzzleRepository(asClient(
      vi.fn().mockReturnValue({ select }),
    )).getByDate(PUZZLE_DATE)).rejects.toMatchObject({
      kind: 'query',
      message: expect.stringContaining('connection failure'),
    });
  });
});

function buildDraft(puzzleDate = PUZZLE_DATE): DailyPuzzleEditorialRecord {
  return createDailyPuzzleDraft({
    id: `daily-${puzzleDate}-v1`,
    puzzleDate,
    puzzleNumber: getDailyPuzzleNumber(puzzleDate),
    selections: Array.from({ length: 9 }, (_, index) => ({
      slot: index + 1,
      canonicalPlayerId: `player-${index + 1}`,
      source: 'generated' as const,
    })),
    actorId: 'editor-1',
    occurredAt: CREATED_AT,
  });
}

function toRow(record: DailyPuzzleEditorialRecord): Record<string, unknown> {
  return {
    id: record.id,
    puzzle_date: record.puzzleDate,
    puzzle_number: record.puzzleNumber,
    version: record.version,
    revision: record.revision,
    status: record.status,
    selections: record.selections.map(selection => ({ ...selection })),
    created_at: record.createdAt,
    created_by: record.createdBy,
    updated_at: record.updatedAt,
    updated_by: record.updatedBy,
    scheduled_at: record.scheduledAt,
    scheduled_by: record.scheduledBy,
    published_at: record.publishedAt,
    published_by: record.publishedBy,
    archived_at: record.archivedAt,
    archived_by: record.archivedBy,
  };
}

function asClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}
