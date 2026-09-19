import { POINTS_V3_MAX_POINTS_PER_AT_BAT } from '@initial-baseball/engine';
import { POINTS_V3_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { DAILY_AT_BAT_COUNT } from './dailyPuzzleSelection';

const DAILY_NINE_MAX_POINTS = POINTS_V3_MAX_POINTS_PER_AT_BAT * DAILY_AT_BAT_COUNT;
const DAILY_NINE_SCORE_HISTOGRAM_LENGTH = DAILY_NINE_MAX_POINTS + 1;

export type DailyNineComparisonKey = {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: typeof POINTS_V3_DAILY_RULESET_VERSION;
};

export type DailyNineAtBatComparisonQuery = DailyNineComparisonKey & {
  pitchNumber: number;
};

/**
 * Provider sufficient statistics for exactly one resolved-AB slot.
 * awardedPointsSum is summed from persisted engine-derived points; providers do not rescore.
 */
export type DailyNineAtBatComparisonSource = {
  resolvedAtBatCount: number;
  awardedPointsSum: number;
};

export type DailyNineScoreBucket = {
  points: number;
  count: number;
};

/** Provider sufficient statistics for the independent completed-game population. */
export type DailyNineCompletedComparisonSource = {
  scoreBuckets: DailyNineScoreBucket[];
};

/**
 * Read-only comparison port. Each method reads one independent population.
 */
export interface DailyNineComparisonRepository {
  readAtBat(query: DailyNineAtBatComparisonQuery): Promise<DailyNineAtBatComparisonSource>;
  readCompletedGames(key: DailyNineComparisonKey): Promise<DailyNineCompletedComparisonSource>;
}

export type DailyNineAtBatComparison = DailyNineAtBatComparisonQuery & {
  resolvedAtBatCount: number;
  averagePoints: number | null;
};

export type DailyNineCompletedComparison = DailyNineComparisonKey & {
  completedGameCount: number;
  averageTotalPoints: number | null;
  /** Index is the final Daily Nine score, from 0 through the points-v3 maximum. */
  scoreHistogram: number[];
};

export type DailyNineComparisonService = {
  getAtBat(query: DailyNineAtBatComparisonQuery): Promise<DailyNineAtBatComparison>;
  getCompletedGames(key: DailyNineComparisonKey): Promise<DailyNineCompletedComparison>;
};

export function createDailyNineComparisonService(
  repository: DailyNineComparisonRepository,
): DailyNineComparisonService {
  return {
    async getAtBat(query) {
      requireIntegerWithin(query.pitchNumber, 1, DAILY_AT_BAT_COUNT, 'pitch number');
      const source = await repository.readAtBat(query);
      requireNonNegativeSafeInteger(source.resolvedAtBatCount, 'resolved-at-bat count');
      requireNonNegativeSafeInteger(source.awardedPointsSum, 'awarded-points sum');

      if (source.resolvedAtBatCount === 0) {
        if (source.awardedPointsSum !== 0) {
          throw new Error('Daily Nine comparison cannot have points without resolved at-bats.');
        }
      } else if (
        source.awardedPointsSum
        > source.resolvedAtBatCount * POINTS_V3_MAX_POINTS_PER_AT_BAT
      ) {
        throw new Error(
          'Daily Nine comparison awarded-points sum exceeds the points-v3 slot maximum.',
        );
      }

      return {
        ...query,
        resolvedAtBatCount: source.resolvedAtBatCount,
        averagePoints: source.resolvedAtBatCount === 0
          ? null
          : source.awardedPointsSum / source.resolvedAtBatCount,
      };
    },

    async getCompletedGames(key) {
      const source = await repository.readCompletedGames(key);
      const scoreHistogram = Array.from(
        { length: DAILY_NINE_SCORE_HISTOGRAM_LENGTH },
        () => 0,
      );
      let completedGameCount = 0;
      let totalPoints = 0;

      for (const bucket of source.scoreBuckets) {
        requireIntegerWithin(bucket.points, 0, DAILY_NINE_MAX_POINTS, 'score bucket');
        requirePositiveSafeInteger(bucket.count, 'score bucket count');

        const nextBucketCount = (scoreHistogram[bucket.points] ?? 0) + bucket.count;
        requireNonNegativeSafeInteger(nextBucketCount, 'score histogram count');
        scoreHistogram[bucket.points] = nextBucketCount;

        completedGameCount += bucket.count;
        totalPoints += bucket.points * bucket.count;
        requireNonNegativeSafeInteger(completedGameCount, 'completed-game count');
        requireNonNegativeSafeInteger(totalPoints, 'completed-game point sum');
      }

      return {
        ...key,
        completedGameCount,
        averageTotalPoints: completedGameCount === 0 ? null : totalPoints / completedGameCount,
        scoreHistogram,
      };
    },
  };
}

/**
 * Fraction of completed games with a strictly lower score than userPoints.
 * Ties remain in the denominator and are not counted as beaten.
 */
export function getDailyNineStrictLowerFinishRate(
  comparison: Pick<DailyNineCompletedComparison, 'completedGameCount' | 'scoreHistogram'>,
  userPoints: number,
): number | null {
  requireIntegerWithin(userPoints, 0, DAILY_NINE_MAX_POINTS, 'user points');
  requireNonNegativeSafeInteger(comparison.completedGameCount, 'completed-game count');

  if (comparison.scoreHistogram.length !== DAILY_NINE_SCORE_HISTOGRAM_LENGTH) {
    throw new Error('Daily Nine comparison score histogram has an invalid length.');
  }

  let lowerCount = 0;
  let histogramCount = 0;
  for (let points = 0; points < comparison.scoreHistogram.length; points += 1) {
    const count = comparison.scoreHistogram[points] ?? 0;
    requireNonNegativeSafeInteger(count, 'score histogram count');
    histogramCount += count;
    requireNonNegativeSafeInteger(histogramCount, 'score histogram total');
    if (points < userPoints) lowerCount += count;
  }

  if (histogramCount !== comparison.completedGameCount) {
    throw new Error('Daily Nine comparison score histogram count does not match completion count.');
  }
  if (comparison.completedGameCount === 0) return null;

  return lowerCount / comparison.completedGameCount;
}

function requirePositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Daily Nine comparison ${field} must be a positive safe integer.`);
  }
}

function requireNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Daily Nine comparison ${field} must be a non-negative safe integer.`);
  }
}

function requireIntegerWithin(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Daily Nine comparison ${field} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
}
