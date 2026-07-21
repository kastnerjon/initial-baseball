import { createDailyPuzzleDraft, publishDailyPuzzle, scheduleDailyPuzzle, archiveDailyPuzzle } from './dailyPuzzleLifecycle';
import { resolvePublicDailyPuzzleSelection } from './publicDailyPuzzleSelection';
import { describe, expect, it } from 'vitest';

const date = '2026-07-22';
const selections = Array.from({ length: 9 }, (_, index) => ({
  slot: index + 1,
  canonicalPlayerId: `player-${index + 1}`,
  source: 'generated' as const,
}));
const draft = createDailyPuzzleDraft({
  id: `daily-${date}-v1`,
  puzzleDate: date,
  puzzleNumber: 87,
  selections,
  actorId: 'editor',
  occurredAt: '2026-07-21T12:00:00.000Z',
});
const scheduled = scheduleDailyPuzzle(draft, { actorId: 'editor', occurredAt: '2026-07-21T13:00:00.000Z' });
const published = publishDailyPuzzle(scheduled, { actorId: 'editor', occurredAt: '2026-07-22T07:00:00.000Z' });
const archived = archiveDailyPuzzle(published, { actorId: 'editor', occurredAt: '2026-07-23T07:00:00.000Z' });

describe('public Daily editorial selection', () => {
  it('preserves the legacy deterministic selector before the lineup-quality launch', () => {
    expect(resolvePublicDailyPuzzleSelection('2026-07-21', published)).toEqual({ kind: 'deterministic-fallback' });
  });

  it('uses only scheduled or published editorial selections', () => {
    expect(resolvePublicDailyPuzzleSelection(date, draft)).toEqual({ kind: 'deterministic-fallback' });
    expect(resolvePublicDailyPuzzleSelection(date, scheduled)).toEqual({
      kind: 'editorial', canonicalPlayerIds: selections.map(selection => selection.canonicalPlayerId),
    });
    expect(resolvePublicDailyPuzzleSelection(date, published).kind).toBe('editorial');
  });

  it('does not silently replace an archived historical answer with a deterministic lineup', () => {
    expect(resolvePublicDailyPuzzleSelection(date, archived)).toEqual({ kind: 'archived-unavailable' });
  });
});
