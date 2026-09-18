import type {
  DailyCompletedAtBat,
  DailySharePitchLine,
} from '@initial-baseball/shared';

export function isNativeCompletedAtBatList(
  value: unknown,
  pitchLines: DailySharePitchLine[],
): value is DailyCompletedAtBat[] {
  return Array.isArray(value)
    && value.length === pitchLines.length
    && value.every(isDailyCompletedAtBat);
}

function isDailyCompletedAtBat(value: unknown): value is DailyCompletedAtBat {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.pitchNumber)
    && (value.pitchNumber as number) >= 1
    && (value.pitchNumber as number) <= 9
    && typeof value.initials === 'string'
    && isOutcome(value.outcome)
    && Number.isInteger(value.hintsRevealed)
    && (value.hintsRevealed as number) >= 0
    && (value.hintsRevealed as number) <= 4
    && Number.isInteger(value.wrongGuesses)
    && (value.wrongGuesses as number) >= 0
    && isResolution(value.resolution);
}

function isOutcome(value: unknown): boolean {
  return value === 'HR' || value === '3B' || value === '2B'
    || value === '1B' || value === 'BB' || value === 'K';
}

function isResolution(value: unknown): boolean {
  return value === 'correct' || value === 'strikeout' || value === 'give_up';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
