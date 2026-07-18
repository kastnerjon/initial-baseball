import { expect, it } from 'vitest';
import { DEFAULT_ALPHA_SETTINGS } from '@initial-baseball/shared';
import { getHitResultForRevealCount } from './getHitResultForRevealCount.js';

it('maps initials-only to home run', () => {
  expect(getHitResultForRevealCount(0, DEFAULT_ALPHA_SETTINGS)).toBe('home_run');
});

it('maps configured hint slots to hit results', () => {
  expect(getHitResultForRevealCount(1, DEFAULT_ALPHA_SETTINGS)).toBe('triple');
  expect(getHitResultForRevealCount(2, DEFAULT_ALPHA_SETTINGS)).toBe('double');
  expect(getHitResultForRevealCount(3, DEFAULT_ALPHA_SETTINGS)).toBe('single');
  expect(getHitResultForRevealCount(4, DEFAULT_ALPHA_SETTINGS)).toBe('walk');
});
