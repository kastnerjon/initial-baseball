import type { DailyAtBatResult } from '@initial-baseball/shared';

/** Stable puzzle ID includes its version; date/number remain checked metadata. */
export type DailyAtBatResultKey = Pick<DailyAtBatResult, 'attemptId' | 'puzzleId' | 'rulesetVersion'> & {
  pitchNumber: number;
};

export type DailyAtBatResultRepositoryInsertResult =
  | { status: 'inserted'; result: DailyAtBatResult }
  | { status: 'existing'; result: DailyAtBatResult };

/**
 * Atomic first-write-wins on (attemptId, puzzleId, rulesetVersion, pitchNumber).
 * Insert the entire normalized record or return the existing winner. Never update.
 * Schema version/date/number must not widen the key and allow duplicate observations.
 */
export interface DailyAtBatResultRepository {
  insertIfAbsent(result: DailyAtBatResult): Promise<DailyAtBatResultRepositoryInsertResult>;
}

export type DailyAtBatResultStoreResult =
  | { ok: true; status: 'created' | 'existing'; result: DailyAtBatResult }
  | { ok: false; error: 'idempotency_conflict'; key: DailyAtBatResultKey };

export type DailyAtBatResultService = {
  store(result: DailyAtBatResult): Promise<DailyAtBatResultStoreResult>;
};

/** Consumes engine-normalized facts/points; does not revalidate or rescore gameplay. */
export function createDailyAtBatResultService(
  repository: DailyAtBatResultRepository,
): DailyAtBatResultService {
  return {
    async store(result) {
      const stored = await repository.insertIfAbsent(result);
      if (!sameKey(stored.result, result)) {
        throw new Error('Daily at-bat repository returned a different observation key.');
      }
      const equal = sameResult(stored.result, result);
      if (stored.status === 'inserted') {
        if (!equal) throw new Error('Daily at-bat repository returned a different inserted result.');
        return { ok: true, status: 'created', result: stored.result };
      }
      if (equal) return { ok: true, status: 'existing', result: stored.result };
      return {
        ok: false,
        error: 'idempotency_conflict',
        key: {
          attemptId: result.attemptId,
          puzzleId: result.puzzleId,
          rulesetVersion: result.rulesetVersion,
          pitchNumber: result.atBat.pitchNumber,
        },
      };
    },
  };
}

function sameKey(left: DailyAtBatResult, right: DailyAtBatResult): boolean {
  return left.attemptId === right.attemptId
    && left.puzzleId === right.puzzleId
    && left.rulesetVersion === right.rulesetVersion
    && left.atBat.pitchNumber === right.atBat.pitchNumber;
}

function sameResult(left: DailyAtBatResult, right: DailyAtBatResult): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.puzzleDate === right.puzzleDate
    && left.puzzleNumber === right.puzzleNumber
    && left.awardedPoints === right.awardedPoints
    && left.atBat.initials === right.atBat.initials
    && left.atBat.outcome === right.atBat.outcome
    && left.atBat.hintsRevealed === right.atBat.hintsRevealed
    && left.atBat.wrongGuesses === right.atBat.wrongGuesses
    && left.atBat.resolution === right.atBat.resolution;
}
