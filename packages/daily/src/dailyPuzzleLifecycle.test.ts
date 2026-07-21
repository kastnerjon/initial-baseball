import { describe, expect, it } from 'vitest';
import {
  archiveDailyPuzzle,
  createDailyPuzzleDraft,
  createDailyPuzzleEditorialService,
  publishDailyPuzzle,
  replaceDailyPuzzleSelection,
  scheduleDailyPuzzle,
  type DailyEditorialSelection,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
  type DailyPuzzleRepositorySaveOptions,
} from './dailyPuzzleLifecycle';

const CREATED_AT = '2026-07-21T12:00:00.000Z';

function buildSelections(): DailyEditorialSelection[] {
  return Array.from({ length: 9 }, (_, index) => ({
    slot: index + 1,
    canonicalPlayerId: `player-${index + 1}`,
    source: 'generated',
  }));
}

function buildDraft(): DailyPuzzleEditorialRecord {
  return createDailyPuzzleDraft({
    id: 'daily-2026-07-29-v1',
    puzzleDate: '2026-07-29',
    puzzleNumber: 94,
    selections: buildSelections(),
    actorId: 'editor-1',
    occurredAt: CREATED_AT,
  });
}

describe('Daily puzzle lifecycle', () => {
  it('creates a normalized version-one draft containing only canonical IDs and editorial metadata', () => {
    const draft = createDailyPuzzleDraft({
      id: 'daily-2026-07-29-v1',
      puzzleDate: '2026-07-29',
      puzzleNumber: 94,
      selections: [...buildSelections()].reverse(),
      actorId: 'editor-1',
      occurredAt: CREATED_AT,
    });

    expect(draft.status).toBe('draft');
    expect(draft.version).toBe(1);
    expect(draft.revision).toBe(0);
    expect(draft.selections.map(selection => selection.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(draft.scheduledAt).toBeNull();
    expect(draft.publishedAt).toBeNull();
    expect(draft.archivedAt).toBeNull();
  });

  it('rejects malformed, duplicate, or incomplete lineups', () => {
    expect(() => createDailyPuzzleDraft({
      id: 'bad',
      puzzleDate: '2026-07-29',
      puzzleNumber: 94,
      selections: buildSelections().slice(0, 8),
      actorId: 'editor-1',
      occurredAt: CREATED_AT,
    })).toThrow('exactly 9 selections');

    const duplicate = buildSelections();
    duplicate[8] = { ...duplicate[8]!, canonicalPlayerId: duplicate[0]!.canonicalPlayerId };
    expect(() => createDailyPuzzleDraft({
      id: 'bad',
      puzzleDate: '2026-07-29',
      puzzleNumber: 94,
      selections: duplicate,
      actorId: 'editor-1',
      occurredAt: CREATED_AT,
    })).toThrow('Duplicate canonical Daily player');
  });

  it('rejects nonexistent dates and puzzle numbers inconsistent with the date', () => {
    expect(() => createDailyPuzzleDraft({
      id: 'bad-date',
      puzzleDate: '2026-02-30',
      puzzleNumber: 1,
      selections: buildSelections(),
      actorId: 'editor-1',
      occurredAt: CREATED_AT,
    })).toThrow('Invalid Daily puzzle date');

    expect(() => createDailyPuzzleDraft({
      id: 'bad-number',
      puzzleDate: '2026-07-29',
      puzzleNumber: 95,
      selections: buildSelections(),
      actorId: 'editor-1',
      occurredAt: CREATED_AT,
    })).toThrow('expected 94');
  });

  it('records manual replacements and returns a scheduled puzzle to draft review', () => {
    const scheduled = scheduleDailyPuzzle(buildDraft(), {
      actorId: 'editor-2',
      occurredAt: '2026-07-21T13:00:00.000Z',
    });
    const updated = replaceDailyPuzzleSelection(scheduled, {
      slot: 4,
      canonicalPlayerId: 'replacement-player',
      actorId: 'editor-3',
      occurredAt: '2026-07-21T14:00:00.000Z',
    });

    expect(updated.status).toBe('draft');
    expect(updated.scheduledAt).toBeNull();
    expect(updated.scheduledBy).toBeNull();
    expect(updated.revision).toBe(2);
    expect(updated.selections[3]).toEqual({
      slot: 4,
      canonicalPlayerId: 'replacement-player',
      source: 'manual',
    });
  });

  it('enforces draft to scheduled to published to archived transitions', () => {
    const draft = buildDraft();
    const scheduled = scheduleDailyPuzzle(draft, {
      actorId: 'editor-2',
      occurredAt: '2026-07-21T13:00:00.000Z',
    });
    const published = publishDailyPuzzle(scheduled, {
      actorId: 'publisher-1',
      occurredAt: '2026-07-29T07:00:00.000Z',
    });
    const archived = archiveDailyPuzzle(published, {
      actorId: 'system-archive',
      occurredAt: '2026-07-30T07:00:00.000Z',
    });

    expect(scheduled.status).toBe('scheduled');
    expect(published.status).toBe('published');
    expect(archived.status).toBe('archived');
    expect(archived.revision).toBe(3);
    expect(archived.publishedBy).toBe('publisher-1');
    expect(archived.archivedBy).toBe('system-archive');
  });

  it('keeps published and archived puzzles immutable for ordinary replacement', () => {
    const published = publishDailyPuzzle(
      scheduleDailyPuzzle(buildDraft(), {
        actorId: 'editor-2',
        occurredAt: '2026-07-21T13:00:00.000Z',
      }),
      { actorId: 'publisher-1', occurredAt: '2026-07-29T07:00:00.000Z' },
    );

    expect(() => replaceDailyPuzzleSelection(published, {
      slot: 1,
      canonicalPlayerId: 'replacement-player',
      actorId: 'editor-3',
      occurredAt: '2026-07-29T08:00:00.000Z',
    })).toThrow('immutable');

    expect(() => archiveDailyPuzzle(buildDraft(), {
      actorId: 'editor-3',
      occurredAt: '2026-07-29T08:00:00.000Z',
    })).toThrow('Only published');
  });

  it('uses repository reads and optimistic revisions through the service boundary', async () => {
    const repository = new InMemoryDailyPuzzleRepository();
    const service = createDailyPuzzleEditorialService(repository);

    const draft = await service.createDraft({
      id: 'daily-2026-07-29-v1',
      puzzleDate: '2026-07-29',
      puzzleNumber: 94,
      selections: buildSelections(),
      actorId: 'editor-1',
      occurredAt: CREATED_AT,
    });
    const scheduled = await service.schedule({
      puzzleDate: draft.puzzleDate,
      actorId: 'editor-2',
      occurredAt: '2026-07-21T13:00:00.000Z',
    });

    expect(scheduled.revision).toBe(1);
    expect(repository.saveCalls).toEqual([
      { puzzleDate: '2026-07-29', expectedRevision: null },
      { puzzleDate: '2026-07-29', expectedRevision: 0 },
    ]);
    await expect(service.createDraft({
      id: 'duplicate',
      puzzleDate: '2026-07-29',
      puzzleNumber: 94,
      selections: buildSelections(),
      actorId: 'editor-1',
      occurredAt: CREATED_AT,
    })).rejects.toThrow('already exists');
  });
});

class InMemoryDailyPuzzleRepository implements DailyPuzzleRepository {
  private readonly records = new Map<string, DailyPuzzleEditorialRecord>();
  readonly saveCalls: Array<{ puzzleDate: string; expectedRevision: number | null }> = [];

  async getByDate(puzzleDate: string): Promise<DailyPuzzleEditorialRecord | null> {
    return this.records.get(puzzleDate) ?? null;
  }

  async listByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<readonly DailyPuzzleEditorialRecord[]> {
    return [...this.records.values()]
      .filter(record => record.puzzleDate >= startDate && record.puzzleDate <= endDate)
      .sort((left, right) => left.puzzleDate.localeCompare(right.puzzleDate));
  }

  async save(
    record: DailyPuzzleEditorialRecord,
    options: DailyPuzzleRepositorySaveOptions,
  ): Promise<DailyPuzzleEditorialRecord> {
    const current = this.records.get(record.puzzleDate);
    const currentRevision = current?.revision ?? null;
    if (currentRevision !== options.expectedRevision) {
      throw new Error(`Daily puzzle revision conflict for ${record.puzzleDate}.`);
    }

    this.saveCalls.push({
      puzzleDate: record.puzzleDate,
      expectedRevision: options.expectedRevision,
    });
    this.records.set(record.puzzleDate, record);
    return record;
  }
}
