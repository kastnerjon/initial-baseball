import { describe, expect, it } from 'vitest';
import {
  appendCustomNinePlayer, isCompleteCustomNineSelection,
  moveCustomNinePlayer, removeCustomNinePlayer,
} from './customNineCreatorSelection';

const player = (i: number) => ({ playerId: 'canonical-' + i, displayName: 'Player ' + i, label: 'Player ' + i });

describe('Custom Nine ordered creator selection', () => {
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
