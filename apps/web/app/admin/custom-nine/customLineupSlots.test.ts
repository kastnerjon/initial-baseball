import { describe, expect, it } from 'vitest';
import {
  chooseCustomLineupSlot, isCompleteCustomLineupSlots, resizeCustomLineupSlots, swapCustomLineupSlots,
} from './customLineupSlots';

const player = (id: number) => ({
  playerId: 'canonical-' + id, displayName: 'Player ' + id, label: 'Player ' + id + ' · 1990–2000',
});

describe('numbered Custom Lineup selection', () => {
  it('requires every slot filled for issuance', () => {
    const nine = Array(9).fill(null);
    expect(isCompleteCustomLineupSlots(nine)).toBe(false);
    let selected: readonly (ReturnType<typeof player> | null)[] = nine;
    for (let i = 0; i < 9; i++) selected = chooseCustomLineupSlot(selected, i, player(i));
    expect(isCompleteCustomLineupSlots(selected)).toBe(true);
    expect(isCompleteCustomLineupSlots([player(0), null, player(2)])).toBe(false);
    expect(isCompleteCustomLineupSlots([player(0), player(0)])).toBe(false);
    expect(isCompleteCustomLineupSlots([])).toBe(false);
  });

  it('can replace any position but never duplicates another slot', () => {
    const original = [player(0), player(1), null];
    expect(chooseCustomLineupSlot(original, 0, player(1))).toBe(original);
    const next = chooseCustomLineupSlot(original, 0, player(2));
    expect(next.map(p => p?.playerId)).toEqual(['canonical-2','canonical-1',undefined]);
    expect(original[0]?.playerId).toBe('canonical-0');
    expect(chooseCustomLineupSlot(original, 3, player(5))).toBe(original);
  });

  it('swaps populated slots without shifting or replacing identities', () => {
    const original = [player(0), null, player(2), player(3)];
    const swapped = swapCustomLineupSlots(original, 0, 3);
    expect(swapped.map(p => p?.playerId)).toEqual(['canonical-3',undefined,'canonical-2','canonical-0']);
    expect(original[0]?.playerId).toBe('canonical-0');
    expect(swapCustomLineupSlots(original, 0, 1)).toBe(original);
    expect(swapCustomLineupSlots(original, 0, 0)).toBe(original);
    expect(swapCustomLineupSlots(original, -1, 2)).toBe(original);
  });

  it('resizes from one to ten, preserves visible positions and truncates the end', () => {
    const ten = resizeCustomLineupSlots([player(1)], 10);
    expect(ten).toHaveLength(10);
    expect(ten[0]).toEqual(player(1));
    expect(ten.slice(1).every(p => p === null)).toBe(true);
    expect(resizeCustomLineupSlots([player(0), player(1)], 1)).toEqual([player(0)]);
    expect(resizeCustomLineupSlots([player(0)], 0)).toHaveLength(1);
    expect(resizeCustomLineupSlots([player(0)], 11)).toHaveLength(1);
    expect(isCompleteCustomLineupSlots([player(0)])).toBe(true);
    expect(isCompleteCustomLineupSlots(Array.from({length:10}, (_,i)=>player(i)))).toBe(true);
  });
});
