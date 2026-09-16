import { describe, expect, it } from 'vitest';
import {
  createDailyPuzzleDraft,
  replaceDailyPuzzleLineup,
  scheduleDailyPuzzle,
} from './dailyPuzzleLifecycle';

function buildDraft() {
  return createDailyPuzzleDraft({
    id: 'daily-2026-09-18-v1',
    puzzleDate: '2026-09-18',
    puzzleNumber: 145,
    selections: Array.from({ length: 9 }, (_, index) => ({
      slot: index + 1,
      canonicalPlayerId: `old-${index + 1}`,
      source: 'generated' as const,
    })),
    actorId: 'editor',
    occurredAt: '2026-09-16T04:00:00.000Z',
  });
}

describe('replaceDailyPuzzleLineup', () => {
  it('replaces all nine slots atomically, marks them manual, and returns scheduled puzzles to draft', () => {
    const scheduled = scheduleDailyPuzzle(buildDraft(), {
      actorId: 'editor',
      occurredAt: '2026-09-16T04:01:00.000Z',
    });
    const ids = Array.from({ length: 9 }, (_, index) => `new-${index + 1}`);

    const updated = replaceDailyPuzzleLineup(scheduled, {
      canonicalPlayerIds: ids,
      actorId: 'chatops:github',
      occurredAt: '2026-09-16T04:02:00.000Z',
    });

    expect(updated.status).toBe('draft');
    expect(updated.scheduledAt).toBeNull();
    expect(updated.scheduledBy).toBeNull();
    expect(updated.revision).toBe(2);
    expect(updated.updatedBy).toBe('chatops:github');
    expect(updated.selections).toEqual(ids.map((canonicalPlayerId, index) => ({
      slot: index + 1,
      canonicalPlayerId,
      source: 'manual',
    })));
  });

  it('rejects incomplete and duplicate full-lineup requests before mutating the record', () => {
    const draft = buildDraft();

    expect(() => replaceDailyPuzzleLineup(draft, {
      canonicalPlayerIds: Array.from({ length: 8 }, (_, index) => `new-${index + 1}`),
      actorId: 'chatops:github',
      occurredAt: '2026-09-16T04:02:00.000Z',
    })).toThrow('exactly 9 selections');

    expect(() => replaceDailyPuzzleLineup(draft, {
      canonicalPlayerIds: ['same', 'same', '3', '4', '5', '6', '7', '8', '9'],
      actorId: 'chatops:github',
      occurredAt: '2026-09-16T04:02:00.000Z',
    })).toThrow('Duplicate canonical Daily player');
  });

  it('keeps published puzzles immutable', () => {
    const scheduled = scheduleDailyPuzzle(buildDraft(), {
      actorId: 'editor',
      occurredAt: '2026-09-16T04:01:00.000Z',
    });
    const published = { ...scheduled, status: 'published' as const };

    expect(() => replaceDailyPuzzleLineup(published, {
      canonicalPlayerIds: Array.from({ length: 9 }, (_, index) => `new-${index + 1}`),
      actorId: 'chatops:github',
      occurredAt: '2026-09-16T04:02:00.000Z',
    })).toThrow('immutable');
  });
});
