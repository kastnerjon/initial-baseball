import { getDailyPointsRange, type DailyPointsRange } from '@initial-baseball/engine';
import {
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import { DAILY_AT_BAT_COUNT } from './dailyConstants';

export type DailyNineComparisonRulesetVersion =
  | typeof POINTS_V3_DAILY_RULESET_VERSION
  | typeof POINTS_V4_DAILY_RULESET_VERSION;

export type DailyNineComparisonIdentity<
  Ruleset extends DailyNineComparisonRulesetVersion = DailyNineComparisonRulesetVersion,
> = {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: Ruleset;
};

/** Exact-version provider-read key for supported Daily Nine scoring versions. */
export type DailyNineComparisonKey = DailyNineComparisonIdentity;

export type DailyNineAtBatComparisonIdentity<
  Ruleset extends DailyNineComparisonRulesetVersion = DailyNineComparisonRulesetVersion,
> = DailyNineComparisonIdentity<Ruleset> & {
  pitchNumber: number;
};

/** Exact-version provider-read query for supported Daily Nine scoring versions. */
export type DailyNineAtBatComparisonQuery = DailyNineAtBatComparisonIdentity;

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
 * Read-only comparison port for exact-version Daily Nine populations.
 * Providers return sufficient statistics only; Daily owns exact-version range validation.
 */
export interface DailyNineComparisonRepository {
  readAtBat(query: DailyNineAtBatComparisonQuery): Promise<DailyNineAtBatComparisonSource>;
  readCompletedGames(key: DailyNineComparisonKey): Promise<DailyNineCompletedComparisonSource>;
}

export type DailyNineAtBatComparison<
  Ruleset extends DailyNineComparisonRulesetVersion = DailyNineComparisonRulesetVersion,
> = DailyNineAtBatComparisonIdentity<Ruleset> & {
  resolvedAtBatCount: number;
  averagePoints: number | null;
};

export type DailyNineCompletedComparison<
  Ruleset extends DailyNineComparisonRulesetVersion = DailyNineComparisonRulesetVersion,
> = DailyNineComparisonIdentity<Ruleset> & {
  completedGameCount: number;
  averageTotalPoints: number | null;
  /**
   * Offset histogram: index 0 is the exact ruleset minimum score and the last
   * index is the exact ruleset maximum score.
   */
  scoreHistogram: number[];
};

export interface DailyNineComparisonService {
  getAtBat<Ruleset extends DailyNineComparisonRulesetVersion>(
    query: DailyNineAtBatComparisonIdentity<Ruleset>,
  ): Promise<DailyNineAtBatComparison<Ruleset>>;
  getCompletedGames<Ruleset extends DailyNineComparisonRulesetVersion>(
    key: DailyNineComparisonIdentity<Ruleset>,
  ): Promise<DailyNineCompletedComparison<Ruleset>>;
}

export function createDailyNineComparisonService(
  repository: DailyNineComparisonRepository,
): DailyNineComparisonService {
  return {
    async getAtBat<Ruleset extends DailyNineComparisonRulesetVersion>(
      query: DailyNineAtBatComparisonIdentity<Ruleset>,
    ): Promise<DailyNineAtBatComparison<Ruleset>> {
      return deriveDailyNineAtBatComparison(query, await repository.readAtBat(query));
    },

    async getCompletedGames<Ruleset extends DailyNineComparisonRulesetVersion>(
      key: DailyNineComparisonIdentity<Ruleset>,
    ): Promise<DailyNineCompletedComparison<Ruleset>> {
      return deriveDailyNineCompletedComparison(
        key,
        await repository.readCompletedGames(key),
      );
    },
  };
}

/**
 * Pure, provider-neutral normalization for one exact-version at-bat population.
 * This can validate v4 aggregates before any database adapter is widened.
 */
export function deriveDailyNineAtBatComparison<
  Ruleset extends DailyNineComparisonRulesetVersion,
>(
  query: DailyNineAtBatComparisonIdentity<Ruleset>,
  source: DailyNineAtBatComparisonSource,
): DailyNineAtBatComparison<Ruleset> {
  requireIntegerWithin(query.pitchNumber, 1, DAILY_AT_BAT_COUNT, 'pitch number');
  requireNonNegativeSafeInteger(source.resolvedAtBatCount, 'resolved-at-bat count');
  const range = requireComparisonRange(query.rulesetVersion, 1);
  requireScoreAligned(source.awardedPointsSum, range.step, 'awarded-points sum');

  if (source.resolvedAtBatCount === 0) {
    if (source.awardedPointsSum !== 0) {
      throw new Error('Daily Nine comparison cannot have points without resolved at-bats.');
    }
  } else {
    const minimumSum = safeScoreProduct(
      range.minimumPoints,
      source.resolvedAtBatCount,
      range.step,
      'minimum awarded-points sum',
    );
    const maximumSum = safeScoreProduct(
      range.maximumPoints,
      source.resolvedAtBatCount,
      range.step,
      'maximum awarded-points sum',
    );
    if (source.awardedPointsSum < minimumSum || source.awardedPointsSum > maximumSum) {
      throw new Error(
        `Daily Nine comparison awarded-points sum is outside the ${query.rulesetVersion} slot range.`,
      );
    }
  }

  return {
    ...query,
    resolvedAtBatCount: source.resolvedAtBatCount,
    averagePoints: source.resolvedAtBatCount === 0
      ? null
      : source.awardedPointsSum / source.resolvedAtBatCount,
  };
}

/**
 * Pure, provider-neutral normalization for an exact-version completed-game population.
 * Histogram indices follow the exact engine-owned minimum and score step.
 */
export function deriveDailyNineCompletedComparison<
  Ruleset extends DailyNineComparisonRulesetVersion,
>(
  key: DailyNineComparisonIdentity<Ruleset>,
  source: DailyNineCompletedComparisonSource,
): DailyNineCompletedComparison<Ruleset> {
  const range = requireComparisonRange(key.rulesetVersion, DAILY_AT_BAT_COUNT);
  const histogramLength = getHistogramLength(range);
  const scoreHistogram = Array.from({ length: histogramLength }, () => 0);
  let completedGameCount = 0;
  let totalPoints = 0;

  for (const bucket of source.scoreBuckets) {
    const histogramIndex = getHistogramIndex(bucket.points, range);
    requirePositiveSafeInteger(bucket.count, 'score bucket count');

    const nextBucketCount = (scoreHistogram[histogramIndex] ?? 0) + bucket.count;
    requireNonNegativeSafeInteger(nextBucketCount, 'score histogram count');
    scoreHistogram[histogramIndex] = nextBucketCount;

    completedGameCount += bucket.count;
    requireNonNegativeSafeInteger(completedGameCount, 'completed-game count');

    const bucketPoints = safeScoreProduct(
      bucket.points,
      bucket.count,
      range.step,
      'score bucket point sum',
    );
    totalPoints = safeScoreSum(
      totalPoints,
      bucketPoints,
      range.step,
      'completed-game point sum',
    );
  }

  return {
    ...key,
    completedGameCount,
    averageTotalPoints: completedGameCount === 0 ? null : totalPoints / completedGameCount,
    scoreHistogram,
  };
}

/**
 * Fraction of completed games with a strictly lower score than userPoints.
 * Ties remain in the denominator and are not counted as beaten.
 */
export function getDailyNineStrictLowerFinishRate(
  comparison: Pick<
    DailyNineCompletedComparison,
    'completedGameCount' | 'scoreHistogram' | 'rulesetVersion'
  >,
  userPoints: number,
): number | null {
  const range = requireComparisonRange(comparison.rulesetVersion, DAILY_AT_BAT_COUNT);
  getHistogramIndex(userPoints, range);
  requireNonNegativeSafeInteger(comparison.completedGameCount, 'completed-game count');

  const expectedLength = getHistogramLength(range);
  if (comparison.scoreHistogram.length !== expectedLength) {
    throw new Error('Daily Nine comparison score histogram has an invalid length.');
  }

  let lowerCount = 0;
  let histogramCount = 0;
  for (let index = 0; index < comparison.scoreHistogram.length; index += 1) {
    const count = comparison.scoreHistogram[index] ?? 0;
    requireNonNegativeSafeInteger(count, 'score histogram count');
    histogramCount += count;
    requireNonNegativeSafeInteger(histogramCount, 'score histogram total');

    const points = range.minimumPoints + index * range.step;
    if (points < userPoints) lowerCount += count;
  }

  if (histogramCount !== comparison.completedGameCount) {
    throw new Error('Daily Nine comparison score histogram count does not match completion count.');
  }
  if (comparison.completedGameCount === 0) return null;

  return lowerCount / comparison.completedGameCount;
}

function requireComparisonRange(
  rulesetVersion: DailyNineComparisonRulesetVersion,
  totalAtBats: number,
): DailyPointsRange {
  const range = getDailyPointsRange(rulesetVersion, totalAtBats);
  if (range === null || (range.step !== 1 && range.step !== 0.5)) {
    throw new Error(
      `Daily Nine comparison ruleset ${rulesetVersion} has an unsupported score step.`,
    );
  }
  return range;
}

function getHistogramLength(range: DailyPointsRange): number {
  const length = ((range.maximumPoints - range.minimumPoints) / range.step) + 1;
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error('Daily Nine comparison score histogram has an invalid range.');
  }
  return length;
}

function getHistogramIndex(points: number, range: DailyPointsRange): number {
  requireScoreWithin(points, range, 'score bucket');
  return (points - range.minimumPoints) / range.step;
}

function safeScoreProduct(
  left: number,
  right: number,
  step: number,
  field: string,
): number {
  const product = left * right;
  requireScoreAligned(product, step, field);
  return product;
}

function safeScoreSum(
  left: number,
  right: number,
  step: number,
  field: string,
): number {
  const sum = left + right;
  requireScoreAligned(sum, step, field);
  return sum;
}

function requireScoreWithin(
  value: number,
  range: DailyPointsRange,
  field: string,
): void {
  requireScoreAligned(value, range.step, field);
  if (value < range.minimumPoints || value > range.maximumPoints) {
    throw new Error(
      `Daily Nine comparison ${field} must be between ${range.minimumPoints} and ${range.maximumPoints}.`,
    );
  }
}

function requireScoreAligned(value: number, step: number, field: string): void {
  if (!Number.isFinite(value)
    || Math.abs(value) > Number.MAX_SAFE_INTEGER
    || !Number.isSafeInteger(value / step)) {
    throw new Error(
      `Daily Nine comparison ${field} must align to the ${step}-point score step.`,
    );
  }
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
