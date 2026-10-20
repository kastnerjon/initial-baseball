import { describe, expect, it } from 'vitest';
import {
  appendCustomNinePlayer, isCompleteCustomNineSelection, isCompleteCustomLineupSelection, isCustomNineDraftEditable,
  moveCustomNinePlayer, removeCustomNinePlayer,
  chooseCustomLineupSlot, resizeCustomLineupSlots, swapCustomLineupSlots, isCompleteCustomLineupSlots,
} from './customNineCreatorSelection';

const player = (i: number) => ({ playerId: 'canonical-' + i, displayName: 'Player ' + i, label: 'Player ' + i });

describe('Custom Nine ordered creator selection', () => {
  it('supports ordered unique 1–10 v2 selections while preserving exact-nine v1', () => {
    expect(isCompleteCustomLineupSelection([])).toBe(false);
    for (const n of [1, 5, 9, 10]) {
      const chosen = Array.from({ length: n }, (_, i) => player(i));
      expect(isCompleteCustomLineupSelection(chosen)).toBe(true);
      expect(isCompleteCustomNineSelection(chosen)).toBe(n === 9);
    }
    const allTen = Array.from({ length: 10 }, (_, i) => player(i));
    expect(appendCustomNinePlayer(allTen, player(10), 10)).toBe(allTen);
    expect(appendCustomNinePlayer(allTen, player(1), 10)).toBe(allTen);
    expect(isCompleteCustomLineupSelection([...allTen, player(10)])).toBe(false);
    expect(isCompleteCustomLineupSelection([player(0), player(0)])).toBe(false);
    const selected = appendCustomNinePlayer([player(0)], player(1), 10);
    expect(selected.map(p => p.playerId)).toEqual(['canonical-0', 'canonical-1']);
    expect(moveCustomNinePlayer(selected, 1, -1).map(p => p.playerId))
      .toEqual(['canonical-1', 'canonical-0']);
    expect(removeCustomNinePlayer(selected, 'canonical-0').map(p => p.playerId))
      .toEqual(['canonical-1']);
  });

  it('locks a successfully issued challenge until explicit reset', () => {
    expect(isCustomNineDraftEditable(null, false)).toBe(true);
    expect(isCustomNineDraftEditable(null, true)).toBe(false);
    expect(isCustomNineDraftEditable('custom-nine-v1-issued', false)).toBe(false);
  });

  it('adds at most nine unique canonical selections in the chosen order', () => {
    let chosen = Array.from({ length: 8 }, (_, i) => player(i));
    chosen = appendCustomNinePlayer(chosen, player(8)) as typeof chosen;
    expect(isCompleteCustomNineSelection(chosen)).toBe(true);
    expect(appendCustomNinePlayer(chosen, player(9))).toBe(chosen);
    expect(appendCustomNinePlayer(chosen, player(7))).toBe(chosen);
    expect(isCompleteCustomNineSelection([...chosen.slice(0, 8), player(7)])).toBe(false);
    expect(isCompleteCustomNineSelection(chosen.slice(0, 8))).toBe(false);
  });

  it('moves without mutating and respects first/last boundaries', () => {
    const chosen = [player(0), player(1), player(2)];
    expect(moveCustomNinePlayer(chosen, 0, -1)).toBe(chosen);
    expect(moveCustomNinePlayer(chosen, 2, 1)).toBe(chosen);
    expect(moveCustomNinePlayer(chosen, 0, 1).map(p => p.playerId))
      .toEqual(['canonical-1', 'canonical-0', 'canonical-2']);
    expect(chosen[0]?.playerId).toBe('canonical-0');
  });

  it('removes a single chosen ID without affecting order of peers', () => {
    const chosen = [player(0), player(1), player(2)];
    expect(removeCustomNinePlayer(chosen, 'canonical-1').map(p => p.playerId))
      .toEqual(['canonical-0', 'canonical-2']);
  });
});

describe('fixed Custom v2 lineup slots', () => {
  it('starts with nine empty spots and supports only lengths one to ten', () => {
    const nine = resizeCustomLineupSlots([], 9);
    expect(nine).toHaveLength(9);
    expect(nine.every(p => p === null)).toBe(true);
    expect(resizeCustomLineupSlots(nine, 0)).toBe(nine);
    expect(resizeCustomLineupSlots(nine, 11)).toBe(nine);
    expect(resizeCustomLineupSlots(nine, 1)).toEqual([null]);
  });

  it('chooses any spot, replaces a player, and refuses duplicate identities', () => {
    const empty = resizeCustomLineupSlots([], 3);
    const a = chooseCustomLineupSlot(empty, 2, player(1));
    const b = chooseCustomLineupSlot(a, 0, player(2));
    expect(b.map(p => p?.playerId)).toEqual(['canonical-2', undefined, 'canonical-1']);
    expect(chooseCustomLineupSlot(b, 1, player(1))).toBe(b);
    expect(chooseCustomLineupSlot(b, 4, player(3))).toBe(b);
    const c = chooseCustomLineupSlot(b, 2, player(3));
    expect(c[2]?.playerId).toBe('canonical-3');
    expect(b[2]?.playerId).toBe('canonical-1');
    expect(isCompleteCustomLineupSlots(c)).toBe(false);
    expect(isCompleteCustomLineupSlots(chooseCustomLineupSlot(c, 1, player(1)))).toBe(true);
  });

  it('swaps full selections including distant slots and empty spots without mutation', () => {
    const original = [player(1), player(2), player(3)];
    const swapped = swapCustomLineupSlots(original, 0, 2);
    expect(swapped.map(p => p?.playerId)).toEqual(['canonical-3','canonical-2','canonical-1']);
    expect(original.map(p => p.playerId)).toEqual(['canonical-1','canonical-2','canonical-3']);
    expect(swapCustomLineupSlots(swapped, 1, 1)).toBe(swapped);
    expect(swapCustomLineupSlots(swapped, 0, 3)).toBe(swapped);
    expect(swapCustomLineupSlots([player(1), null], 0, 1)).toEqual([null, player(1)]);
  });

  it('requires all active slots and cuts trailing selections when shrinking', () => {
    const chosen = [player(1), player(2), player(3)];
    expect(isCompleteCustomLineupSlots(chosen)).toBe(true);
    expect(isCompleteCustomLineupSlots([player(1), null, player(3)])).toBe(false);
    expect(isCompleteCustomLineupSlots([player(1), player(1)])).toBe(false);
    expect(resizeCustomLineupSlots(chosen, 2).map(p => p?.playerId))
      .toEqual(['canonical-1', 'canonical-2']);
    expect(isCompleteCustomLineupSlots(resizeCustomLineupSlots([], 10))).toBe(false);
    const extended = resizeCustomLineupSlots(chosen, 4);
    expect(extended.map(p => p?.playerId)).toEqual([
      'canonical-1', 'canonical-2', 'canonical-3', undefined,
    ]);
    expect(isCompleteCustomLineupSlots(extended)).toBe(false);
  });
});
