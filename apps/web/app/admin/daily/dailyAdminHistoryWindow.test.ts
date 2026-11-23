import { describe, expect, it } from 'vitest';
import { getDailyAdminHistoryWindow } from './dailyAdminHistoryWindow';

describe('Daily admin historical pagination', () => {
  it('starts with yesterday and provides bounded older and newer pages', () => {
    const latest = getDailyAdminHistoryWindow('2026-11-23', '');
    expect(latest).toEqual({
      startDate: '2026-10-24',
      endDate: '2026-11-22',
      olderEndDate: '2026-10-23',
      newerEndDate: null,
    });
    const older = getDailyAdminHistoryWindow('2026-11-23', latest.olderEndDate!);
    expect(older.endDate).toBe('2026-10-23');
    expect(older.newerEndDate).toBe('2026-11-22');
    expect(older.olderEndDate).toBe('2026-09-23');
  });

  it('clamps at the Daily epoch and rejects malformed and future query dates', () => {
    const first = getDailyAdminHistoryWindow('2026-11-23', '2026-04-27');
    expect(first.startDate).toBe('2026-04-27');
    expect(first.olderEndDate).toBeNull();
    for (const invalid of ['2026-02-30', '2026-11-23', '2999-01-01', 'x', '2025-01-01']) {
      expect(getDailyAdminHistoryWindow('2026-11-23', invalid).endDate).toBe('2026-11-22');
    }
  });
});
