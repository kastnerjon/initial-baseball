import { describe, expect, it } from 'vitest';
import { getDailyDateStringForTimeZone, getPacificDailyDateString } from './getPacificDailyDateString';

describe('getPacificDailyDateString', () => {
  it('returns the prior Pacific date before midnight Pacific', () => {
    const date = new Date('2026-05-04T06:59:59.000Z');

    expect(getPacificDailyDateString(date)).toBe('2026-05-03');
  });

  it('returns the new Pacific date after midnight Pacific', () => {
    const date = new Date('2026-05-04T07:00:00.000Z');

    expect(getPacificDailyDateString(date)).toBe('2026-05-04');
  });

  it('is stable for America/Los_Angeles', () => {
    const date = new Date('2026-12-15T08:00:00.000Z');

    expect(getDailyDateStringForTimeZone(date, 'America/Los_Angeles')).toBe('2026-12-15');
  });

  it('avoids UTC rollover surprises', () => {
    const date = new Date('2026-05-04T02:30:00.000Z');

    expect(date.toISOString().slice(0, 10)).toBe('2026-05-04');
    expect(getPacificDailyDateString(date)).toBe('2026-05-03');
  });
});
