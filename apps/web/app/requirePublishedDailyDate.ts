import { DAILY_PUZZLE_EPOCH } from '@initial-baseball/daily';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { DailyRuntimeRequestError } from './dailyRuntimeService';

const DAILY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function requirePublishedDailyDate(
  value: unknown,
  currentDailyDate = getPacificDailyDateString(),
): string {
  if (typeof value !== 'string' || !DAILY_DATE_PATTERN.test(value)) {
    throw new DailyRuntimeRequestError('puzzleDate must use YYYY-MM-DD format.');
  }
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new DailyRuntimeRequestError('puzzleDate must be a real calendar date.');
  }
  if (value < DAILY_PUZZLE_EPOCH) {
    throw new DailyRuntimeRequestError(`puzzleDate must be on or after ${DAILY_PUZZLE_EPOCH}.`);
  }
  if (value > currentDailyDate) {
    throw new DailyRuntimeRequestError('Future Daily puzzles are not published.');
  }
  return value;
}
