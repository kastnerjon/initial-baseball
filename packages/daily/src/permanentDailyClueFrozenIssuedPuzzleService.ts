import {
  areClueFrozenIssuedDailyPuzzlesExactlyEqual,
  hasSameImmutableClueFrozenIssuedDailyContent,
} from './issuedDailyPuzzleCore';
import {
  PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
  clonePermanentDailyIssuedPuzzleRecord,
  createPermanentDailyClueFrozenIssuedPuzzle,
  type PermanentDailyClueFrozenIssuedPuzzle,
  type PermanentDailyClueFrozenIssuedPuzzleInput,
  type PermanentDailyIssuedPuzzleRecord,
  type PermanentDailyIssuedPuzzleRepository,
} from './permanentDailyIssuedPuzzle';

export type PermanentDailyClueFrozenIssuedPuzzleStoreResult =
  | {
      ok: true;
      status: 'created' | 'existing';
      puzzle: PermanentDailyClueFrozenIssuedPuzzle;
    }
  | {
      ok: false;
      error: 'immutable_conflict';
      requested: PermanentDailyClueFrozenIssuedPuzzle;
      existing: PermanentDailyIssuedPuzzleRecord;
    };

export type PermanentDailyClueFrozenIssuedPuzzleService = {
  issue(
    input: PermanentDailyClueFrozenIssuedPuzzleInput,
  ): Promise<PermanentDailyClueFrozenIssuedPuzzleStoreResult>;
};

/**
 * Provider-neutral first-write-wins service for schema-v2 clue-frozen records.
 *
 * Exact immutable retries are idempotent and retain the first issue timestamp.
 * Any clue change or cross-schema collision is an immutable conflict.
 */
export function createPermanentDailyClueFrozenIssuedPuzzleService(
  repository: PermanentDailyIssuedPuzzleRepository,
): PermanentDailyClueFrozenIssuedPuzzleService {
  return {
    async issue(input) {
      const requested = createPermanentDailyClueFrozenIssuedPuzzle(input);
      const stored = await repository.insertIfAbsent(requested);

      if (stored.status === 'inserted') {
        if (
          stored.puzzle.schemaVersion !== PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
          || !areClueFrozenIssuedDailyPuzzlesExactlyEqual(stored.puzzle, requested)
        ) {
          throw new Error(
            'Permanent Daily issued-puzzle repository returned a different inserted clue-frozen puzzle.',
          );
        }
        return {
          ok: true,
          status: 'created',
          puzzle: cloneClueFrozenIssuedPuzzle(stored.puzzle),
        };
      }

      if (
        stored.puzzle.schemaVersion === PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
        && hasSameImmutableClueFrozenIssuedDailyContent(stored.puzzle, requested)
      ) {
        return {
          ok: true,
          status: 'existing',
          puzzle: cloneClueFrozenIssuedPuzzle(stored.puzzle),
        };
      }

      return {
        ok: false,
        error: 'immutable_conflict',
        requested,
        existing: clonePermanentDailyIssuedPuzzleRecord(stored.puzzle),
      };
    },
  };
}

function cloneClueFrozenIssuedPuzzle(
  puzzle: PermanentDailyClueFrozenIssuedPuzzle,
): PermanentDailyClueFrozenIssuedPuzzle {
  const cloned = clonePermanentDailyIssuedPuzzleRecord(puzzle);
  if (cloned.schemaVersion !== PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION) {
    throw new Error('Expected a clue-frozen permanent Daily puzzle.');
  }
  return cloned;
}
