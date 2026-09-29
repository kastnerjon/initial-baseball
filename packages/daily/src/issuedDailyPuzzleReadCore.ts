import {
  cloneIssuedDailyPuzzleRecord,
  validateIssuedDailyCalendarDate,
  validateIssuedDailyNumber,
  type IssuedDailyIdentity,
  type IssuedDailyPuzzleRecord,
} from './issuedDailyPuzzleCore';

export type IssuedDailyPuzzleNumberQuery<I extends IssuedDailyIdentity> = Pick<
  I,
  'seriesVersion' | 'dailyNumber'
>;

export type IssuedDailyPuzzleDateQuery<I extends IssuedDailyIdentity> = Pick<
  I,
  'seriesVersion' | 'puzzleDate'
>;

export interface IssuedDailyPuzzleReadRepository<
  I extends IssuedDailyIdentity,
  R extends IssuedDailyPuzzleRecord<I>,
> {
  getByNumber(query: IssuedDailyPuzzleNumberQuery<I>): Promise<R | null>;
  getByDate(query: IssuedDailyPuzzleDateQuery<I>): Promise<R | null>;
}

export type IssuedDailyPuzzleReadService<
  I extends IssuedDailyIdentity,
  R extends IssuedDailyPuzzleRecord<I>,
> = {
  getByNumber(query: IssuedDailyPuzzleNumberQuery<I>): Promise<R | null>;
  getByDate(query: IssuedDailyPuzzleDateQuery<I>): Promise<R | null>;
};

export function createIssuedDailyPuzzleReadService<
  I extends IssuedDailyIdentity,
  R extends IssuedDailyPuzzleRecord<I>,
>({
  seriesVersion,
  seriesLabel,
  supportedSchemaVersions,
  repository,
}: {
  seriesVersion: I['seriesVersion'];
  seriesLabel: string;
  supportedSchemaVersions: readonly number[];
  repository: IssuedDailyPuzzleReadRepository<I, R>;
}): IssuedDailyPuzzleReadService<I, R> {
  return {
    async getByNumber(query) {
      requireSeriesVersion(query.seriesVersion, seriesVersion, seriesLabel);
      validateIssuedDailyNumber(query.dailyNumber);

      const record = await repository.getByNumber({ ...query });
      if (record === null) return null;
      const puzzle = requireSupportedSchema(record, supportedSchemaVersions, seriesLabel);
      if (
        puzzle.identity.seriesVersion !== query.seriesVersion
        || puzzle.identity.dailyNumber !== query.dailyNumber
      ) {
        throw new Error(
          `${seriesLabel} issued-puzzle reader returned a different number identity.`,
        );
      }
      return cloneIssuedDailyPuzzleRecord(puzzle) as R;
    },

    async getByDate(query) {
      requireSeriesVersion(query.seriesVersion, seriesVersion, seriesLabel);
      validateIssuedDailyCalendarDate(query.puzzleDate);

      const record = await repository.getByDate({ ...query });
      if (record === null) return null;
      const puzzle = requireSupportedSchema(record, supportedSchemaVersions, seriesLabel);
      if (
        puzzle.identity.seriesVersion !== query.seriesVersion
        || puzzle.identity.puzzleDate !== query.puzzleDate
      ) {
        throw new Error(
          `${seriesLabel} issued-puzzle reader returned a different date identity.`,
        );
      }
      return cloneIssuedDailyPuzzleRecord(puzzle) as R;
    },
  };
}

function requireSeriesVersion(
  actual: string,
  expected: string,
  seriesLabel: string,
): void {
  if (actual !== expected) {
    throw new Error(`Unsupported ${seriesLabel} series version: ${actual}.`);
  }
}

function requireSupportedSchema<
  I extends IssuedDailyIdentity,
  R extends IssuedDailyPuzzleRecord<I>,
>(
  puzzle: R,
  supportedSchemaVersions: readonly number[],
  seriesLabel: string,
): R {
  const schemaVersion: unknown = (puzzle as { schemaVersion: unknown }).schemaVersion;
  if (
    typeof schemaVersion !== 'number'
    || !supportedSchemaVersions.includes(schemaVersion)
  ) {
    throw new Error(
      `Unsupported ${seriesLabel.toLowerCase()} issued-puzzle schema version: ${String(schemaVersion)}.`,
    );
  }
  return puzzle;
}
