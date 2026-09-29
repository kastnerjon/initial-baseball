import {
  formatUtcCalendarDay,
  requirePositiveSafeDailyNumber,
  requireUtcCalendarDay,
} from './dailySeriesCalendar';

export const PERMANENT_DAILY_SERIES_VERSION = 'permanent-v1' as const;

export type PermanentDailyLaunchEpoch = {
  seriesVersion: typeof PERMANENT_DAILY_SERIES_VERSION;
  launchDate: string;
};

export type PermanentDailyIdentity = {
  seriesVersion: typeof PERMANENT_DAILY_SERIES_VERSION;
  puzzleDate: string;
  dailyNumber: number;
};

export function createPermanentDailyLaunchEpoch(
  launchDate: string,
): PermanentDailyLaunchEpoch {
  requireUtcCalendarDay(launchDate, 'Permanent Daily launch date');
  return {
    seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
    launchDate,
  };
}

export function resolvePermanentDailyIdentityForDate(
  puzzleDate: string,
  epoch: PermanentDailyLaunchEpoch,
): PermanentDailyIdentity | null {
  requirePermanentSeries(epoch);
  const launchDay = requireUtcCalendarDay(epoch.launchDate, 'Permanent Daily launch date');
  const puzzleDay = requireUtcCalendarDay(puzzleDate, 'Permanent Daily puzzle date');
  const dayOffset = puzzleDay - launchDay;

  if (dayOffset < 0) {
    return null;
  }

  return {
    seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
    puzzleDate,
    dailyNumber: dayOffset + 1,
  };
}

export function resolvePermanentDailyIdentityForNumber(
  dailyNumber: number,
  epoch: PermanentDailyLaunchEpoch,
): PermanentDailyIdentity {
  requirePermanentSeries(epoch);
  const launchDay = requireUtcCalendarDay(epoch.launchDate, 'Permanent Daily launch date');

  requirePositiveSafeDailyNumber(dailyNumber, 'Permanent Daily number');

  const puzzleDay = launchDay + dailyNumber - 1;
  const puzzleDate = formatUtcCalendarDay(
    puzzleDay,
    'Permanent Daily number resolves outside the supported calendar range.',
  );

  return {
    seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
    puzzleDate,
    dailyNumber,
  };
}

function requirePermanentSeries(epoch: PermanentDailyLaunchEpoch): void {
  if (epoch.seriesVersion !== PERMANENT_DAILY_SERIES_VERSION) {
    throw new Error(
      `Unsupported Permanent Daily series version: ${String(epoch.seriesVersion)}.`,
    );
  }
}
