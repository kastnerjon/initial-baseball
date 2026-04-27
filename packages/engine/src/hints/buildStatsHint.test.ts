import { expect, it } from 'vitest';
import { buildStatsHint } from './buildStatsHint.js';

it('builds hitter stats with bWAR label', () => {
  expect(buildStatsHint({
    role: 'hitter',
    stats: { bwar: 83.8, hr: 630 },
    config: { hitter: ['bwar', 'hr'], pitcher: ['bwar'] },
  })).toBe('83.8 bWAR / 630 HR');
});

it('builds pitcher stats with configured fields', () => {
  expect(buildStatsHint({
    role: 'pitcher',
    stats: { bwar: 83.9, era: 2.93, k: 3154 },
    config: { hitter: ['bwar'], pitcher: ['bwar', 'era', 'k'] },
  })).toBe('83.9 bWAR / 2.93 ERA / 3154 K');
});
