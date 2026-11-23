import { DAILY_PUZZLE_EPOCH } from '@initial-baseball/daily';

export const DAILY_ADMIN_HISTORY_PAGE_DAYS = 30;

export type DailyAdminHistoryWindow = {
  startDate: string;
  endDate: string;
  olderEndDate: string | null;
  newerEndDate: string | null;
};

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function getDailyAdminHistoryWindow(
  currentDate: string,
  requestedEndDate: string,
): DailyAdminHistoryWindow {
  const latestEndDate = shiftDate(currentDate, -1);
  const endDate = isCalendarDate(requestedEndDate)
    && requestedEndDate >= DAILY_PUZZLE_EPOCH
    && requestedEndDate <= latestEndDate
    ? requestedEndDate
    : latestEndDate;
  const earliestInPage = shiftDate(endDate, 1 - DAILY_ADMIN_HISTORY_PAGE_DAYS);
  const startDate = earliestInPage < DAILY_PUZZLE_EPOCH ? DAILY_PUZZLE_EPOCH : earliestInPage;
  const newerEndCandidate = shiftDate(endDate, DAILY_ADMIN_HISTORY_PAGE_DAYS);
  return {
    startDate,
    endDate,
    olderEndDate: startDate > DAILY_PUZZLE_EPOCH ? shiftDate(startDate, -1) : null,
    newerEndDate: endDate < latestEndDate
      ? (newerEndCandidate > latestEndDate ? latestEndDate : newerEndCandidate)
      : null,
  };
}
