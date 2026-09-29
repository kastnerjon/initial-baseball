import {
  formatUtcCalendarDay,
  requirePositiveSafeDailyNumber,
  requireUtcCalendarDay,
} from './dailySeriesCalendar';

export const ARCHIVE_BETA_DAILY_SERIES_VERSION = 'archive-beta-v1' as const;

export type ArchiveBetaDailyEpoch = {
  seriesVersion: typeof ARCHIVE_BETA_DAILY_SERIES_VERSION;
  startDate: string;
};

export type ArchiveBetaDailyIdentity = {
  seriesVersion: typeof ARCHIVE_BETA_DAILY_SERIES_VERSION;
  puzzleDate: string;
  dailyNumber: number;
};

export function createArchiveBetaDailyEpoch(
  startDate: string,
): ArchiveBetaDailyEpoch {
  requireUtcCalendarDay(startDate, 'Archive beta Daily start date');
  return {
    seriesVersion: ARCHIVE_BETA_DAILY_SERIES_VERSION,
    startDate,
  };
}

export function createArchiveBetaDailyPuzzleId(
  identity: ArchiveBetaDailyIdentity,
): string {
  requireArchiveBetaSeries(identity);
  requireUtcCalendarDay(identity.puzzleDate, 'Archive beta Daily puzzle date');
  requirePositiveSafeDailyNumber(identity.dailyNumber, 'Archive beta Daily number');
  return `${identity.seriesVersion}-daily-${identity.dailyNumber}`;
}

export function resolveArchiveBetaDailyIdentityForDate(
  puzzleDate: string,
  epoch: ArchiveBetaDailyEpoch,
): ArchiveBetaDailyIdentity | null {
  requireArchiveBetaSeries(epoch);
  const startDay = requireUtcCalendarDay(epoch.startDate, 'Archive beta Daily start date');
  const puzzleDay = requireUtcCalendarDay(puzzleDate, 'Archive beta Daily puzzle date');
  const dayOffset = puzzleDay - startDay;

  if (dayOffset < 0) {
    return null;
  }

  return {
    seriesVersion: ARCHIVE_BETA_DAILY_SERIES_VERSION,
    puzzleDate,
    dailyNumber: dayOffset + 1,
  };
}

export function resolveArchiveBetaDailyIdentityForNumber(
  dailyNumber: number,
  epoch: ArchiveBetaDailyEpoch,
): ArchiveBetaDailyIdentity {
  requireArchiveBetaSeries(epoch);
  const startDay = requireUtcCalendarDay(epoch.startDate, 'Archive beta Daily start date');
  requirePositiveSafeDailyNumber(dailyNumber, 'Archive beta Daily number');

  const puzzleDay = startDay + dailyNumber - 1;
  const puzzleDate = formatUtcCalendarDay(
    puzzleDay,
    'Archive beta Daily number resolves outside the supported calendar range.',
  );

  return {
    seriesVersion: ARCHIVE_BETA_DAILY_SERIES_VERSION,
    puzzleDate,
    dailyNumber,
  };
}

function requireArchiveBetaSeries(value: { seriesVersion: unknown }): void {
  if (value.seriesVersion !== ARCHIVE_BETA_DAILY_SERIES_VERSION) {
    throw new Error(
      `Unsupported archive beta Daily series version: ${String(value.seriesVersion)}.`,
    );
  }
}
