import { describe, expect, it } from 'vitest';
import {
  isOfficialDailyOccurrenceId, validateIssuedDailyCalendarDate,
} from './officialDailyBrowserIdentity';

describe('browser-safe official Daily identity entrypoint', () => {
  it('accepts only lowercase UUIDv4 occurrence identities', () => {
    expect(isOfficialDailyOccurrenceId('907f33db-c38f-43c3-8e6b-a3aaf19bbd08')).toBe(true);
    for (const id of [
      '', null, {}, 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
      '907F33DB-c38f-43c3-8e6b-a3aaf19bbd08',
      '907f33db-c38f-13c3-8e6b-a3aaf19bbd08',
      '907f33db-c38f-43c3-1e6b-a3aaf19bbd08',
      '../907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
    ]) expect(isOfficialDailyOccurrenceId(id)).toBe(false);
  });

  it('accepts real calendar dates and rejects malformed/normalized days', () => {
    expect(() => validateIssuedDailyCalendarDate('2024-02-29')).not.toThrow();
    expect(() => validateIssuedDailyCalendarDate('2026-11-06')).not.toThrow();
    for (const date of [
      '2026-02-29', '2026-02-30', '2026-13-01',
      '2026-11-6', '2026-11-06?answers=1', '2026-11-06/../07',
      '', '2026-00-01',
    ]) expect(() => validateIssuedDailyCalendarDate(date)).toThrow();
  });
});
