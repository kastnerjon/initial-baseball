import { DEFAULT_DAILY_HINT_CONFIG } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { prepareOfficialDailyPublication, type OfficialDailyPublicationInput } from './officialDailyPublication';
import { createPermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';

const selections = Array.from({ length: 9 }, (_, index) => ({
  slot: index + 1, canonicalPlayerId: `player-${index + 1}`, source: 'manual' as const,
}));
const input: OfficialDailyPublicationInput = {
  occurrenceId: '6077ee21-9370-4cf3-aa21-74c50b485591',
  editionKey: 'modern', editionNumber: 2,
  editorial: { puzzleDate: '2026-11-06', puzzleNumber: 194, status: 'scheduled', selections: [...selections].reverse() },
};
function snapshot(ids: readonly string[]) {
  return createPermanentDailyIssuedClueSnapshot({
    hintLayout: DEFAULT_DAILY_HINT_CONFIG,
    pitches: ids.map((canonicalPlayerId, index) => ({
      canonicalPlayerId, pitchNumber: index + 1, initials: 'AB', hintValues: ['1990s', 'NYM', 'CF', '3 HR'],
    })),
  });
}

describe('official edition publication', () => {
  it('uses editorial order and date, and keeps identical same-day rosters independent', () => {
    const materialize = vi.fn(snapshot);
    const a = prepareOfficialDailyPublication(input, materialize);
    expect(materialize).toHaveBeenCalledWith(selections.map(s => s.canonicalPlayerId), '2026-11-06');
    expect(a).toMatchObject({ title: 'Puzzle 2', rulesetVersion: 'points-v4', puzzleId: 'daily-ed-v1-' + input.occurrenceId });
    expect(prepareOfficialDailyPublication(input, snapshot)).toEqual(a);
    const b = prepareOfficialDailyPublication({
      ...input, occurrenceId: '269b64cf-1242-4775-a2e3-04b999ae088e',
      editionKey: 'mixed', editionNumber: 3, title: 'Mixed',
    }, snapshot);
    expect(b.puzzleId).not.toBe(a.puzzleId);
    expect(b.clueSnapshot).toEqual(a.clueSnapshot);
    expect(b.title).toBe('Mixed');
  });

  it('rejects a valid clue snapshot for the wrong batting order', () => {
    expect(() => prepareOfficialDailyPublication(input, ids => snapshot([...ids].reverse()))).toThrow('batting order');
  });

  it.each<Partial<OfficialDailyPublicationInput>>([
    { occurrenceId: [input.occurrenceId] as unknown as string }, { occurrenceId: 'legacy' }, { editionKey: 'Mixed/Modern' }, { editionNumber: 0 }, { title: '<invalid>' },
    { editorial: { ...input.editorial, status: 'draft' } },
    { editorial: { ...input.editorial, puzzleNumber: 193 } },
    { editorial: { ...input.editorial, puzzleDate: '2026-02-30' } },
    { editorial: { ...input.editorial, selections: selections.slice(1) } },
  ])('rejects invalid editorial input before materializing clues', overrides => {
    const materialize = vi.fn(snapshot);
    expect(() => prepareOfficialDailyPublication({ ...input, ...overrides }, materialize)).toThrow();
    expect(materialize).not.toHaveBeenCalled();
  });
});
