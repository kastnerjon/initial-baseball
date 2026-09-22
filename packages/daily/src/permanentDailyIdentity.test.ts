import { describe, expect, it } from 'vitest';
import {
  PERMANENT_DAILY_SERIES_VERSION,
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
  resolvePermanentDailyIdentityForNumber,
  type PermanentDailyLaunchEpoch,
} from './permanentDailyIdentity';

describe('Permanent Daily identity', () => {
  it('starts the explicitly configured launch date at Daily #1', () => {
    const epoch = createPermanentDailyLaunchEpoch('2030-04-05');

    expect(resolvePermanentDailyIdentityForDate('2030-04-04', epoch)).toBeNull();
    expect(resolvePermanentDailyIdentityForDate('2030-04-05', epoch)).toEqual({
      seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
      puzzleDate: '2030-04-05',
      dailyNumber: 1,
    });
    expect(resolvePermanentDailyIdentityForDate('2030-04-06', epoch)).toEqual({
      seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
      puzzleDate: '2030-04-06',
      dailyNumber: 2,
    });
  });

  it('uses calendar-day arithmetic across leap days and DST boundaries', () => {
    const leapEpoch = createPermanentDailyLaunchEpoch('2028-02-28');
    expect(resolvePermanentDailyIdentityForDate('2028-02-29', leapEpoch)?.dailyNumber).toBe(2);
    expect(resolvePermanentDailyIdentityForDate('2028-03-01', leapEpoch)?.dailyNumber).toBe(3);

    const dstEpoch = createPermanentDailyLaunchEpoch('2026-03-07');
    expect(resolvePermanentDailyIdentityForDate('2026-03-08', dstEpoch)?.dailyNumber).toBe(2);
    expect(resolvePermanentDailyIdentityForDate('2026-03-09', dstEpoch)?.dailyNumber).toBe(3);
  });

  it('maps permanent Daily numbers back to their exact calendar dates', () => {
    const epoch = createPermanentDailyLaunchEpoch('2030-04-05');

    expect(resolvePermanentDailyIdentityForNumber(1, epoch)).toEqual({
      seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
      puzzleDate: '2030-04-05',
      dailyNumber: 1,
    });
    expect(resolvePermanentDailyIdentityForNumber(366, epoch)).toEqual({
      seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
      puzzleDate: '2031-04-05',
      dailyNumber: 366,
    });
  });

  it.each([
    '2030-4-05',
    '2030-02-30',
    'not-a-date',
  ])('rejects invalid calendar date %s', (value) => {
    expect(() => createPermanentDailyLaunchEpoch(value)).toThrow();
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid permanent Daily number %s',
    (dailyNumber) => {
      const epoch = createPermanentDailyLaunchEpoch('2030-04-05');
      expect(() => resolvePermanentDailyIdentityForNumber(dailyNumber, epoch)).toThrow(
        'Permanent Daily number must be a positive safe integer.',
      );
    },
  );

  it('rejects a safe integer that resolves outside the supported calendar range', () => {
    const epoch = createPermanentDailyLaunchEpoch('2030-04-05');
    expect(() => resolvePermanentDailyIdentityForNumber(Number.MAX_SAFE_INTEGER, epoch)).toThrow(
      'Permanent Daily number resolves outside the supported calendar range.',
    );
  });

  it('rejects an unsupported series version at the portable boundary', () => {
    const invalidEpoch = {
      seriesVersion: 'future-series',
      launchDate: '2030-04-05',
    } as unknown as PermanentDailyLaunchEpoch;

    expect(() => resolvePermanentDailyIdentityForDate('2030-04-05', invalidEpoch)).toThrow(
      'Unsupported Permanent Daily series version: future-series.',
    );
  });
});
