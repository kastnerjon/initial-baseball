import { describe, expect, it } from 'vitest';
import { requirePublishedDailyDate } from './requirePublishedDailyDate';

describe('requirePublishedDailyDate', () => {
  it('accepts the current and historical published Daily dates', () => {
    expect(requirePublishedDailyDate('2026-07-20', '2026-07-20')).toBe('2026-07-20');
    expect(requirePublishedDailyDate('2026-04-27', '2026-07-20')).toBe('2026-04-27');
  });

  it('rejects malformed, pre-epoch, and future dates', () => {
    expect(() => requirePublishedDailyDate('July 20', '2026-07-20')).toThrow(/YYYY-MM-DD/);
    expect(() => requirePublishedDailyDate('2026-02-31', '2026-07-20')).toThrow(/real calendar/);
    expect(() => requirePublishedDailyDate('2026-04-26', '2026-07-20')).toThrow(/on or after/);
    expect(() => requirePublishedDailyDate('2026-07-21', '2026-07-20')).toThrow(/not published/);
  });
});
