import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVEAL_COLUMNS,
  getDailyHintStatColumns,
  getRevealColumns,
  type RevealColumnOverrides,
} from './revealPresentationConfig';

describe('revealPresentationConfig', () => {
  it('orders supported hitter reveal fields like Baseball-Reference and preserves pitcher defaults', () => {
    expect(DEFAULT_REVEAL_COLUMNS.hitter).toEqual([
      'AB',
      'R',
      'H',
      'HR',
      'RBI',
      'SB',
      'BA',
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

  it('derives hint-4 stat subsets in reveal-relative order', () => {
    expect(getDailyHintStatColumns('hitter')).toEqual(['HR', 'RBI', 'SB', 'BA', 'OBP']);
    expect(getDailyHintStatColumns('pitcher')).toEqual(['W', 'L', 'SV', 'ERA', 'WHIP', 'K']);
  });

});
