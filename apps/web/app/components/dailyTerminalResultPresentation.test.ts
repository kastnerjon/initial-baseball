import { describe, expect, it } from 'vitest';
import { createDailyTerminalResultCallout } from './dailyTerminalResultPresentation';

describe('createDailyTerminalResultCallout', () => {
  it.each([
    ['HR', 4, 'HR! 4 PTS'],
    ['3B', 3, '3B 3 PTS'],
    ['2B', 2, '2B 2 PTS'],
    ['1B', 1, '1B 1 PT'],
    ['BB', 0.5, 'BB 0.5 PTS'],
    ['K', 0, 'K 0 PTS'],
  ] as const)('formats %s with exact baseball punctuation and awarded points', (outcome, points, expected) => {
    expect(createDailyTerminalResultCallout(outcome, points)).toBe(expected);
  });

  it('keeps outcome and awarded points independent', () => {
    expect(createDailyTerminalResultCallout('HR', 2)).toBe('HR! 2 PTS');
  });
});
