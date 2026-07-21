import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVEAL_COLUMNS,
  getRevealColumns,
  type RevealColumnOverrides,
} from './revealPresentationConfig';

describe('revealPresentationConfig', () => {
  it('keeps the launch hitter and pitcher defaults', () => {
    expect(DEFAULT_REVEAL_COLUMNS.hitter).toEqual([
      'AB',
      'H',
      'HR',
      'BA',
      'R',
      'RBI',
      'SB',
      'OBP',
      'SLG',
      'OPS',
    ]);
    expect(DEFAULT_REVEAL_COLUMNS.pitcher).toEqual([
      'W',
      'L',
      'SV',
      'ERA',
      'WHIP',
      'K',
      'IP',
    ]);
  });

  it('uses an override for one stat kind without changing the other default', () => {
    const overrides = {
      hitter: ['HR', 'BA', 'OPS'],
    } satisfies RevealColumnOverrides;

    expect(getRevealColumns('hitter', overrides)).toEqual(['HR', 'BA', 'OPS']);
    expect(getRevealColumns('pitcher', overrides)).toEqual(DEFAULT_REVEAL_COLUMNS.pitcher);
  });
});
