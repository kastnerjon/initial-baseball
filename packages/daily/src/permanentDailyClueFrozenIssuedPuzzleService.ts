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
          || !areClueFrozenIssuedPuzzlesExactlyEqual(stored.puzzle, requested)
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
        && hasSameImmutableClueFrozenContent(stored.puzzle, requested)
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

function hasSameImmutableClueFrozenContent(
  left: PermanentDailyClueFrozenIssuedPuzzle,
  right: PermanentDailyClueFrozenIssuedPuzzle,
): boolean {
  return left.puzzleId === right.puzzleId
    && left.identity.seriesVersion === right.identity.seriesVersion
    && left.identity.puzzleDate === right.identity.puzzleDate
    && left.identity.dailyNumber === right.identity.dailyNumber
    && arraysEqual(left.canonicalPlayerIds, right.canonicalPlayerIds)
    && clueSnapshotsEqual(left, right);
}

function areClueFrozenIssuedPuzzlesExactlyEqual(
  left: PermanentDailyClueFrozenIssuedPuzzle,
  right: PermanentDailyClueFrozenIssuedPuzzle,
): boolean {
  return hasSameImmutableClueFrozenContent(left, right)
    && left.issuedAt === right.issuedAt;
}

function clueSnapshotsEqual(
  left: PermanentDailyClueFrozenIssuedPuzzle,
  right: PermanentDailyClueFrozenIssuedPuzzle,
): boolean {
  const leftSnapshot = left.clueSnapshot;
  const rightSnapshot = right.clueSnapshot;

  return leftSnapshot.schemaVersion === rightSnapshot.schemaVersion
    && leftSnapshot.hintLayout.length === rightSnapshot.hintLayout.length
    && leftSnapshot.hintLayout.every((slot, index) => {
      const other = rightSnapshot.hintLayout[index];
      return other !== undefined
        && slot.slot === other.slot
        && slot.hintType === other.hintType
        && slot.displayLabel === other.displayLabel;
    })
    && leftSnapshot.pitches.length === rightSnapshot.pitches.length
    && leftSnapshot.pitches.every((pitch, index) => {
      const other = rightSnapshot.pitches[index];
      return other !== undefined
        && pitch.pitchNumber === other.pitchNumber
        && pitch.canonicalPlayerId === other.canonicalPlayerId
        && pitch.initials === other.initials
        && arraysEqual(pitch.hintValues, other.hintValues);
    });
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
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
