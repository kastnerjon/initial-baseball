const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function requireUtcCalendarDay(value: string, label: string): number {
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

export function requirePositiveSafeDailyNumber(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
}

export function formatUtcCalendarDay(day: number, outOfRangeMessage: string): string {
  const date = new Date(day * MILLISECONDS_PER_DAY);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(outOfRangeMessage);
  }

  const value = date.toISOString().slice(0, 10);
  if (!ISO_CALENDAR_DATE_PATTERN.test(value)) {
    throw new Error(outOfRangeMessage);
  }

  return value;
}
