const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

  if (!Number.isSafeInteger(dailyNumber) || dailyNumber < 1) {
    throw new Error('Permanent Daily number must be a positive safe integer.');
  }

  const puzzleDay = launchDay + dailyNumber - 1;
  const puzzleDate = formatUtcCalendarDay(puzzleDay);

  return {
    seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
    puzzleDate,
    dailyNumber,
  };
}

function formatUtcCalendarDay(day: number): string {
  const date = new Date(day * MILLISECONDS_PER_DAY);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Permanent Daily number resolves outside the supported calendar range.');
  }

  const value = date.toISOString().slice(0, 10);
  if (!ISO_CALENDAR_DATE_PATTERN.test(value)) {
    throw new Error('Permanent Daily number resolves outside the supported calendar range.');
  }

  return value;
}

function requirePermanentSeries(epoch: PermanentDailyLaunchEpoch): void {
  if (epoch.seriesVersion !== PERMANENT_DAILY_SERIES_VERSION) {
    throw new Error(
      `Unsupported Permanent Daily series version: ${String(epoch.seriesVersion)}.`,
    );
  }
}

function requireUtcCalendarDay(value: string, label: string): number {
  if (!ISO_CALENDAR_DATE_PATTERN.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} is not a valid calendar date.`);
  }

  const normalized = new Date(timestamp).toISOString().slice(0, 10);
  if (normalized !== value) {
    throw new Error(`${label} is not a valid calendar date.`);
  }

  return Math.floor(timestamp / MILLISECONDS_PER_DAY);
}
