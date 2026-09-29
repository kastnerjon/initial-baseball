import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_BETA_DAILY_SERIES_VERSION,
  createArchiveBetaDailyEpoch,
  resolveArchiveBetaDailyIdentityForDate,
  resolveArchiveBetaDailyIdentityForNumber,
  type ArchiveBetaDailyEpoch,
} from './archiveBetaDailyIdentity';
import { PERMANENT_DAILY_SERIES_VERSION } from './permanentDailyIdentity';

describe('Archive beta Daily identity', () => {
  it('starts the explicitly supplied beta epoch at Daily #1 without using permanent identity', () => {
    const epoch = createArchiveBetaDailyEpoch('2026-09-29');

    expect(resolveArchiveBetaDailyIdentityForDate('2026-09-28', epoch)).toBeNull();
    expect(resolveArchiveBetaDailyIdentityForDate('2026-09-29', epoch)).toEqual({
      seriesVersion: ARCHIVE_BETA_DAILY_SERIES_VERSION,
      puzzleDate: '2026-09-29',
      dailyNumber: 1,
    });
    expect(resolveArchiveBetaDailyIdentityForDate('2026-09-30', epoch)).toEqual({
      seriesVersion: ARCHIVE_BETA_DAILY_SERIES_VERSION,
      puzzleDate: '2026-09-30',
      dailyNumber: 2,
    });
    expect(ARCHIVE_BETA_DAILY_SERIES_VERSION).not.toBe(PERMANENT_DAILY_SERIES_VERSION);
  });

  it('uses calendar-day arithmetic across leap days and DST boundaries', () => {
    const leapEpoch = createArchiveBetaDailyEpoch('2028-02-28');
    expect(resolveArchiveBetaDailyIdentityForDate('2028-02-29', leapEpoch)?.dailyNumber).toBe(2);
    expect(resolveArchiveBetaDailyIdentityForDate('2028-03-01', leapEpoch)?.dailyNumber).toBe(3);

    const dstEpoch = createArchiveBetaDailyEpoch('2026-03-07');
    expect(resolveArchiveBetaDailyIdentityForDate('2026-03-08', dstEpoch)?.dailyNumber).toBe(2);
    expect(resolveArchiveBetaDailyIdentityForDate('2026-03-09', dstEpoch)?.dailyNumber).toBe(3);
  });

  it('maps beta Daily numbers back to exact calendar dates', () => {
    const epoch = createArchiveBetaDailyEpoch('2026-09-29');

    expect(resolveArchiveBetaDailyIdentityForNumber(1, epoch)).toEqual({
      seriesVersion: ARCHIVE_BETA_DAILY_SERIES_VERSION,
      puzzleDate: '2026-09-29',
      dailyNumber: 1,
    });
    expect(resolveArchiveBetaDailyIdentityForNumber(366, epoch)).toEqual({
      seriesVersion: ARCHIVE_BETA_DAILY_SERIES_VERSION,
      puzzleDate: '2027-09-29',
      dailyNumber: 366,
    });
  });

  it.each([
    '2026-9-29',
    '2026-02-30',
    'not-a-date',
  ])('rejects invalid calendar date %s', (value) => {
    expect(() => createArchiveBetaDailyEpoch(value)).toThrow();
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid archive beta Daily number %s',
    (dailyNumber) => {
      const epoch = createArchiveBetaDailyEpoch('2026-09-29');
      expect(() => resolveArchiveBetaDailyIdentityForNumber(dailyNumber, epoch)).toThrow(
        'Archive beta Daily number must be a positive safe integer.',
      );
    },
  );

  it('rejects a safe integer that resolves outside the supported calendar range', () => {
    const epoch = createArchiveBetaDailyEpoch('2026-09-29');
    expect(() => resolveArchiveBetaDailyIdentityForNumber(Number.MAX_SAFE_INTEGER, epoch)).toThrow(
      'Archive beta Daily number resolves outside the supported calendar range.',
    );
  });

  it('rejects an unsupported series version at the portable boundary', () => {
    const invalidEpoch = {
      seriesVersion: 'permanent-v1',
      startDate: '2026-09-29',
    } as unknown as ArchiveBetaDailyEpoch;

    expect(() => resolveArchiveBetaDailyIdentityForDate('2026-09-29', invalidEpoch)).toThrow(
      'Unsupported archive beta Daily series version: permanent-v1.',
    );
  });
});
