import type {
  PermanentDailyIssuedPuzzleRecord,
} from './permanentDailyIssuedPuzzle';
import { clonePermanentDailyIssuedPuzzleRecord } from './permanentDailyIssuedPuzzle';
import {
  PERMANENT_DAILY_SERIES_VERSION,
  type PermanentDailyIdentity,
} from './permanentDailyIdentity';

export type PermanentDailyIssuedPuzzleNumberQuery = Pick<
  PermanentDailyIdentity,
  'seriesVersion' | 'dailyNumber'
>;

export type PermanentDailyIssuedPuzzleDateQuery = Pick<
  PermanentDailyIdentity,
  'seriesVersion' | 'puzzleDate'
>;

/**
 * Provider-neutral read-only boundary for immutable permanent Daily puzzles.
 *
 * Number and date are both durable lookup keys stored with the frozen puzzle.
 * Callers do not need a configured launch epoch merely to retrieve an already
 * issued row.
 */
export interface PermanentDailyIssuedPuzzleReadRepository {
  getByNumber(
    query: PermanentDailyIssuedPuzzleNumberQuery,
  ): Promise<PermanentDailyIssuedPuzzleRecord | null>;
  getByDate(
    query: PermanentDailyIssuedPuzzleDateQuery,
  ): Promise<PermanentDailyIssuedPuzzleRecord | null>;
}

export type PermanentDailyIssuedPuzzleReadService = {
  getByNumber(
    query: PermanentDailyIssuedPuzzleNumberQuery,
  ): Promise<PermanentDailyIssuedPuzzleRecord | null>;
  getByDate(
    query: PermanentDailyIssuedPuzzleDateQuery,
  ): Promise<PermanentDailyIssuedPuzzleRecord | null>;
};

export function createPermanentDailyIssuedPuzzleReadService(
  repository: PermanentDailyIssuedPuzzleReadRepository,
): PermanentDailyIssuedPuzzleReadService {
  return {
    async getByNumber(query) {
      requireSeriesVersion(query.seriesVersion);
      requireDailyNumber(query.dailyNumber);

      const record = await repository.getByNumber({ ...query });
      if (record === null) return null;
      const puzzle = requireSupportedIssuedPuzzle(record);
      if (
        puzzle.identity.seriesVersion !== query.seriesVersion
        || puzzle.identity.dailyNumber !== query.dailyNumber
      ) {
        throw new Error(
          'Permanent Daily issued-puzzle reader returned a different number identity.',
        );
      }
      return clonePermanentDailyIssuedPuzzleRecord(puzzle);
    },

    async getByDate(query) {
      requireSeriesVersion(query.seriesVersion);
      requireCalendarDate(query.puzzleDate);

      const record = await repository.getByDate({ ...query });
      if (record === null) return null;
      const puzzle = requireSupportedIssuedPuzzle(record);
      if (
        puzzle.identity.seriesVersion !== query.seriesVersion
        || puzzle.identity.puzzleDate !== query.puzzleDate
      ) {
        throw new Error(
          'Permanent Daily issued-puzzle reader returned a different date identity.',
        );
      }
      return clonePermanentDailyIssuedPuzzleRecord(puzzle);
    },
  };
}

function requireSupportedIssuedPuzzle(
  puzzle: PermanentDailyIssuedPuzzleRecord,
): PermanentDailyIssuedPuzzleRecord {
  const schemaVersion: unknown = (puzzle as { schemaVersion: unknown }).schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    throw new Error(
      `Unsupported permanent Daily issued-puzzle schema version: ${String(schemaVersion)}.`,
    );
  }
  return puzzle;
}

function requireSeriesVersion(value: string): void {
  if (value !== PERMANENT_DAILY_SERIES_VERSION) {
    throw new Error(`Unsupported Permanent Daily series version: ${value}.`);
  }
}

function requireDailyNumber(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('Permanent Daily number must be a positive safe integer.');
  }
}

function requireCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Permanent Daily puzzle date must use YYYY-MM-DD.');
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Permanent Daily puzzle date is not a valid calendar date.');
  }
}
