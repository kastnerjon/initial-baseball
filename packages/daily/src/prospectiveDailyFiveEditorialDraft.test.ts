import { describe, expect, it } from 'vitest';
import {
  createDailyPuzzleDraft,
  createProspectiveDailyFiveEditorialDraft,
  getDailyPuzzleNumber,
} from './index';

const date = '2026-11-16';
const selection = (slot: number) => ({
  slot,
  canonicalPlayerId: 'ibp_' + slot.toString(16).padStart(20, '0'),
  source: 'manual' as const,
});
const input = (slots: readonly number[] = [1, 2, 3, 4, 5]) => ({
  id: 'qa-five-draft',
  puzzleDate: date,
  puzzleNumber: getDailyPuzzleNumber(date),
  selections: slots.map(selection),
  actorId: 'admin-qa',
  occurredAt: '2026-10-16T19:00:00.000Z',
});

describe('prospective Daily Five editorial contract only', () => {
  it('creates a marked draft with exactly five ordered canonical selections, no scheduling or publication', () => {
    const draft = createProspectiveDailyFiveEditorialDraft(input([5, 3, 1, 4, 2]));
    expect(draft.lineupContractVersion).toBe(2);
    expect(draft.status).toBe('draft');
    expect(draft.selections.map(p => p.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(draft.selections.map(p => p.canonicalPlayerId)).toEqual([1, 2, 3, 4, 5]
      .map(slot => selection(slot).canonicalPlayerId));
    expect(draft.version).toBe(1);
    expect(draft.revision).toBe(0);
    expect(draft.scheduledAt).toBeNull();
    expect(draft.publishedAt).toBeNull();
    expect(draft.archivedAt).toBeNull();
    expect(draft.selections).not.toBe(input().selections);
  });

  it('requires five exact positions, distinct players and valid canonical identifiers', () => {
    for (const slots of [[1, 2, 3, 4], [1, 2, 3, 4, 5, 6]]) {
      expect(() => createProspectiveDailyFiveEditorialDraft(input(slots)))
        .toThrow('exactly 5 selections');
    }
    expect(() => createProspectiveDailyFiveEditorialDraft(input([1, 2, 3, 4, 6])))
      .toThrow('between 1 and 5');
    expect(() => createProspectiveDailyFiveEditorialDraft(input([1, 2, 3, 4, 4])))
      .toThrow('Duplicate Daily puzzle slot');
    expect(() => createProspectiveDailyFiveEditorialDraft({
      ...input(), selections: [selection(1),selection(2),selection(3),selection(4),
        {...selection(5), canonicalPlayerId: selection(1).canonicalPlayerId}],
    })).toThrow('Duplicate canonical Daily player');
    expect(() => createProspectiveDailyFiveEditorialDraft({
      ...input(), selections: [selection(1),selection(2),selection(3),selection(4),
        {...selection(5), canonicalPlayerId: '  '}],
    })).toThrow('canonical player ID is required');
  });

  it('inherits authoritative date, number and actor validation without a persistence call', () => {
    expect(() => createProspectiveDailyFiveEditorialDraft({
      ...input(), puzzleNumber: 1,
    })).toThrow('does not match');
    expect(() => createProspectiveDailyFiveEditorialDraft({
      ...input(), puzzleDate:'invalid',
    })).toThrow();
    expect(() => createProspectiveDailyFiveEditorialDraft({
      ...input(), actorId:'',
    })).toThrow();
  });

  it('keeps existing daily draft creation strictly nine-only and structurally unchanged', () => {
    expect(() => createDailyPuzzleDraft(input())).toThrow('exactly 9 selections');
    const legacy = createDailyPuzzleDraft(input([1,2,3,4,5,6,7,8,9]));
    expect(legacy).not.toHaveProperty('lineupContractVersion');
    expect(legacy.selections).toHaveLength(9);
    expect(legacy.status).toBe('draft');
  });
});
