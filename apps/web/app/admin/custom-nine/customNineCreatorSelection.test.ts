import { describe, expect, it } from 'vitest';
import {
  appendCustomNinePlayer, isCompleteCustomNineSelection, isCompleteCustomLineupSelection, isCustomNineDraftEditable,
  moveCustomNinePlayer, removeCustomNinePlayer,
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
