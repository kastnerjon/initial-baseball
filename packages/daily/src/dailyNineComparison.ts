import { POINTS_V3_MAX_POINTS_PER_AT_BAT } from '@initial-baseball/engine';
import { POINTS_V3_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { DAILY_AT_BAT_COUNT } from './dailyPuzzleSelection';

const DAILY_NINE_MAX_POINTS_PER_AT_BAT = POINTS_V3_MAX_POINTS_PER_AT_BAT;
const DAILY_NINE_MAX_POINTS = DAILY_NINE_MAX_POINTS_PER_AT_BAT * DAILY_AT_BAT_COUNT;
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
  sourceReadAt: string;
  resolvedAtBatCount: number;
  awardedPointsSum: number;
};

export type DailyNineScoreBucket = {
  points: number;
  count: number;
};

/**
 * Provider sufficient statistics for the independent completed-game population.
 * sourceReadAt is when the provider snapshot was read; cached consumers preserve it.
 */
export type DailyNineCompletedComparisonSource = {
  sourceReadAt: string;
  scoreBuckets: DailyNineScoreBucket[];
};

export interface DailyNineComparisonRepository {
  readAtBat(query: DailyNineAtBatComparisonQuery): Promise<DailyNineAtBatComparisonSource>;
  readCompletedGames(key: DailyNineComparisonKey): Promise<DailyNineCompletedComparisonSource>;
}

export type DailyNineAtBatComparison = DailyNineAtBatComparisonQuery & {
  sourceReadAt: string;
  resolvedAtBatCount: number;
  awardedPointsSum: number;
  averagePoints: number | null;
};

export type DailyNineCompletedComparison = DailyNineComparisonKey & {
  sourceReadAt: string;
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
      requirePitchNumber(query.pitchNumber);
      const source = await repository.readAtBat(query);
      validateSourceReadAt(source.sourceReadAt);
      requireNonNegativeInteger(source.resolvedAtBatCount, 'resolved-at-bat count');
      requireNonNegativeInteger(source.awardedPointsSum, 'awarded-points sum');

      if (source.resolvedAtBatCount === 0) {
        if (source.awardedPointsSum !== 0) {
          throw new Error('Daily Nine comparison cannot have points without resolved at-bats.');
        }
      } else if (source.awardedPointsSum > source.resolvedAtBatCount * DAILY_NINE_MAX_POINTS_PER_AT_BAT) {
        throw new Error('Daily Nine comparison awarded-points sum exceeds the points-v3 slot maximum.');
      }

      return {
        ...query,
        sourceReadAt: source.sourceReadAt,
        resolvedAtBatCount: source.resolvedAtBatCount,
        awardedPointsSum: source.awardedPointsSum,
        averagePoints: source.resolvedAtBatCount === 0
          ? null
          : source.awardedPointsSum / source.resolvedAtBatCount,
      };
    },

    async getCompletedGames(key) {
      const source = await repository.readCompletedGames(key);
      validateSourceReadAt(source.sourceReadAt);

      const scoreHistogram = Array.from(
        { length: DAILY_NINE_SCORE_HISTOGRAM_LENGTH },
        () => 0,
      );
      let completedGameCount = 0;
      let totalPoints = 0;

      for (const bucket of source.scoreBuckets) {
        requireIntegerWithin(bucket.points, 0, DAILY_NINE_MAX_POINTS, 'score bucket');
        requirePositiveInteger(bucket.count, 'score bucket count');
        scoreHistogram[bucket.points] = (scoreHistogram[bucket.points] ?? 0) + bucket.count;
        completedGameCount += bucket.count;
        totalPoints += bucket.points * bucket.count;
      }

      return {
        ...key,
        sourceReadAt: source.sourceReadAt,
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
export function getDailyNineStrictLowerFinishersRate(
  comparison: Pick<DailyNineCompletedComparison, 'completedGameCount' | 'scoreHistogram'>,
  userPoints: number,
): number | null {
  requireIntegerWithin(userPoints, 0, DAILY_NINE_MAX_POINTS, 'user points');
  if (comparison.completedGameCount === 0) return null;
  if (comparison.scoreHistogram.length !== DAILY_NINE_SCORE_HISTOGRAM_LENGTH) {
    throw new Error('Daily Nine comparison score histogram has an invalid length.');
  }

  let lowerCount = 0;
  let histogramCount = 0;
  for (let points = 0; points < comparison.scoreHistogram.length; points += 1) {
    const count = comparison.scoreHistogram[points] ?? 0;
    requireNonNegativeInteger(count, 'score histogram count');
    histogramCount += count;
    if (points < userPoints) lowerCount += count;
  }
  if (histogramCount !== comparison.completedGameCount) {
    throw new Error('Daily Nine comparison score histogram count does not match completion count.');
  }

  return lowerCount / comparison.completedGameCount;
}

function validateSourceReadAt(value: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Daily Nine comparison sourceReadAt must be a non-empty string.');
  }
}

function requirePitchNumber(value: number): void {
  requireIntegerWithin(value, 1, DAILY_AT_BAT_COUNT, 'pitch number');
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Daily Nine comparison ${field} must be a positive integer.`);
  }
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Daily Nine comparison ${field} must be a non-negative integer.`);
  }
}

function requireIntegerWithin(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Daily Nine comparison ${field} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
}
