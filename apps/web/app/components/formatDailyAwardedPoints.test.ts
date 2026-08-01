import { describe, expect, it } from 'vitest';
import { formatDailyAwardedPoints } from './formatDailyAwardedPoints';

describe('formatDailyAwardedPoints', () => {
  it.each([
    [4, '4 points'],
    [3, '3 points'],
    [2, '2 points'],
    [1, '1 point'],
    [0.5, '0.5 points'],
    [0, '0 points'],
  ])('formats %s as %s', (points, expected) => {
    expect(formatDailyAwardedPoints(points)).toBe(expected);
  });
});
