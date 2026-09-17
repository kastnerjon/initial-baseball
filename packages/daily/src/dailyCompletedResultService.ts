import type { DailyCompletedResult } from '@initial-baseball/shared';

export type DailyCompletedResultRepositoryInsertResult =
  | { status: 'inserted'; result: DailyCompletedResult }
  | { status: 'existing'; result: DailyCompletedResult };

/**
 * Provider-neutral persistence port for one completed result.
 *
 * Implementations must make submissionId the atomic first-write-wins key:
 * - insert the supplied normalized result when the ID is absent;
 * - never overwrite an existing row for that ID;
 * - return the existing stored result when the ID is already present.
 */
export interface DailyCompletedResultRepository {
  insertIfAbsent(result: DailyCompletedResult): Promise<DailyCompletedResultRepositoryInsertResult>;
}

export type DailyCompletedResultStoreResult =
  | {
      ok: true;
      status: 'created' | 'existing';
      result: DailyCompletedResult;
    }
  | {
      ok: false;
      error: 'idempotency_conflict';
      submissionId: string;
    };

export type DailyCompletedResultService = {
  store(result: DailyCompletedResult): Promise<DailyCompletedResultStoreResult>;
};

/**
 * Persists an already validated/derived result without reinterpreting gameplay.
 * Validation and summary derivation remain engine-owned.
 */
export function createDailyCompletedResultService(
  repository: DailyCompletedResultRepository,
): DailyCompletedResultService {
  return {
    async store(result) {
      const stored = await repository.insertIfAbsent(result);

      if (stored.status === 'inserted') {
        if (!areDailyCompletedResultsEqual(stored.result, result)) {
          throw new Error('Daily completed-result repository returned a different inserted result.');
        }
        return { ok: true, status: 'created', result: stored.result };
      }

      if (areDailyCompletedResultsEqual(stored.result, result)) {
        return { ok: true, status: 'existing', result: stored.result };
      }

      return {
        ok: false,
        error: 'idempotency_conflict',
        submissionId: result.submissionId,
      };
    },
  };
}

function areDailyCompletedResultsEqual(
  left: DailyCompletedResult,
  right: DailyCompletedResult,
): boolean {
  if (left.schemaVersion !== right.schemaVersion
    || left.submissionId !== right.submissionId
    || left.puzzleId !== right.puzzleId
    || left.puzzleDate !== right.puzzleDate
    || left.puzzleNumber !== right.puzzleNumber
    || left.rulesetVersion !== right.rulesetVersion
    || left.completedAtBats.length !== right.completedAtBats.length) {
    return false;
  }

  for (let index = 0; index < left.completedAtBats.length; index += 1) {
    const leftAtBat = left.completedAtBats[index];
    const rightAtBat = right.completedAtBats[index];
    if (!leftAtBat || !rightAtBat
      || leftAtBat.pitchNumber !== rightAtBat.pitchNumber
      || leftAtBat.initials !== rightAtBat.initials
      || leftAtBat.outcome !== rightAtBat.outcome
      || leftAtBat.hintsRevealed !== rightAtBat.hintsRevealed
      || leftAtBat.wrongGuesses !== rightAtBat.wrongGuesses
      || leftAtBat.resolution !== rightAtBat.resolution) {
      return false;
    }
  }

  if (left.rulesetVersion === 'points-v3' && right.rulesetVersion === 'points-v3') {
    return left.summary.points === right.summary.points
      && left.summary.maximumPoints === right.summary.maximumPoints
      && left.summary.atBatsCompleted === right.summary.atBatsCompleted
      && left.summary.totalAtBats === right.summary.totalAtBats
      && left.summary.completed === right.summary.completed
      && left.summary.strikeouts === right.summary.strikeouts;
  }

  if (left.rulesetVersion === 'classic-inning-v1'
    && right.rulesetVersion === 'classic-inning-v1') {
    return left.summary.runs === right.summary.runs
      && left.summary.hits === right.summary.hits
      && left.summary.outs === right.summary.outs
      && left.summary.strikeouts === right.summary.strikeouts
      && left.summary.completed === right.summary.completed
      && left.summary.atBatsCompleted === right.summary.atBatsCompleted
      && left.summary.totalAtBats === right.summary.totalAtBats;
  }

  return false;
}
