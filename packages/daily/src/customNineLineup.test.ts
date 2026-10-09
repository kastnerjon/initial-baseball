import { describe, expect, it } from 'vitest';
import { createCustomNineLineupSelection, CUSTOM_NINE_LINEUP_SCHEMA_VERSION } from './customNineLineup';

const IDS = Array.from({ length: 9 }, (_, i) => `canonical-player-${i + 1}`);

describe('Custom Nine ordered player selection', () => {
  it('accepts exactly nine distinct canonical IDs, retaining their requested order', () => {
    const reversed = [...IDS].reverse();
    const selection = createCustomNineLineupSelection(reversed);
    expect(selection).toEqual({
      schemaVersion: CUSTOM_NINE_LINEUP_SCHEMA_VERSION,
      canonicalPlayerIds: reversed,
    });
    expect(selection.canonicalPlayerIds).not.toBe(reversed);
    reversed[0] = 'changed-after-validation';
    expect(selection.canonicalPlayerIds[0]).toBe('canonical-player-9');
    expect(Object.isFrozen(selection.canonicalPlayerIds)).toBe(true);
  });

  it('rejects too few, too many, and duplicated players, including when spread across slots', () => {
    expect(() => createCustomNineLineupSelection(IDS.slice(0, 8))).toThrow('exactly nine');
    expect(() => createCustomNineLineupSelection([...IDS, 'canonical-player-10'])).toThrow('exactly nine');
    expect(() => createCustomNineLineupSelection([...IDS.slice(0, 8), IDS[0]!])).toThrow('same player');
  });

  it('rejects empty, padded, non-string, and unbounded identifiers without normalizing them', () => {
    for (const bad of ['', ' ', ' canonical-id', 'canonical-id ', 'x'.repeat(201)]) {
      expect(() => createCustomNineLineupSelection([...IDS.slice(0, 8), bad]))
        .toThrow('valid canonical player IDs');
    }
    expect(() => createCustomNineLineupSelection([...IDS.slice(0, 8), 42] as unknown as string[]))
      .toThrow('valid canonical player IDs');
    expect(() => createCustomNineLineupSelection(null as unknown as string[])).toThrow('exactly nine');
  });

  it('does not introduce any team, era, WAR, or Standard Daily automatic-pool filter', () => {
    const ids = [...IDS.slice(0, 8), 'less-recognizable-but-canonical'];
    expect(createCustomNineLineupSelection(ids).canonicalPlayerIds).toEqual(ids);
  });
});
