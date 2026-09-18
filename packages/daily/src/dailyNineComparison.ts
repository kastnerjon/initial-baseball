import {
  getDailyAtBatPoints,
  POINTS_V3_MAX_POINTS_PER_AT_BAT,
} from '@initial-baseball/engine';
import {
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyAtBatResolution,
  type DailyOutcome,
  type DailyRevealCount,
} from '@initial-baseball/shared';
import { DAILY_AT_BAT_COUNT } from './dailyPuzzleSelection';

const OUTCOMES: readonly DailyOutcome[] = ['HR', '3B', '2B', '1B', 'BB', 'K'];
const RESOLUTIONS: readonly DailyAtBatResolution[] = ['correct', 'strikeout', 'give_up'];
const MAX_DAILY_NINE_POINTS = DAILY_AT_BAT_COUNT * POINTS_V3_MAX_POINTS_PER_AT_BAT;

export type DailyNineComparisonPopulationKey = {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: typeof POINTS_V3_DAILY_RULESET_VERSION;
};

export type DailyNineScoreBucket = {
  points: number;
  count: number;
};

export type DailyNineAtBatFactBucket = {
  pitchNumber: number;
  outcome: DailyOutcome;
  hintsRevealed: DailyRevealCount;
  wrongGuesses: number;
  resolution: DailyAtBatResolution;
  count: number;
};

/**
 * Provider-neutral sufficient statistics for one exact puzzle/ruleset population.
 *
 * Providers may group persisted rows however is efficient, but they return facts,
 * not scored comparison semantics. points-v3 per-at-bat scoring stays engine-owned.
 */
export type DailyNineComparisonPopulation = {
  scoreBuckets: DailyNineScoreBucket[];
  atBatFactBuckets: DailyNineAtBatFactBucket[];
};

export interface DailyNineComparisonRepository {
  readPopulation(
    key: DailyNineComparisonPopulationKey,
  ): Promise<DailyNineComparisonPopulation>;
}

export type DailyNineScoreDistributionBucket = {
  points: number;
  count: number;
  rate: number;
};

export type DailyNineAtBatComparison = {
  pitchNumber: number;
  sampleSize: number;
  averagePoints: number;
  averageHintsRevealed: number;
  hintUseRate: number;
  outcomeRates: Record<DailyOutcome, number>;
  resolutionRates: Record<DailyAtBatResolution, number>;
};

export type DailyNineComparison = DailyNineComparisonPopulationKey & {
  completionCount: number;
  averageTotalPoints: number;
  scoreDistribution: DailyNineScoreDistributionBucket[];
  atBats: DailyNineAtBatComparison[];
};

export type DailyNineComparisonService = {
  get(key: DailyNineComparisonPopulationKey): Promise<DailyNineComparison>;
};

export function createDailyNineComparisonService(
  repository: DailyNineComparisonRepository,
): DailyNineComparisonService {
  return {
    async get(key) {
      return {
        ...key,
        ...aggregateDailyNineComparison(await repository.readPopulation(key)),
      };
    },
  };
}

export function aggregateDailyNineComparison(
  population: DailyNineComparisonPopulation,
): Omit<DailyNineComparison, keyof DailyNineComparisonPopulationKey> {
  const scoreCounts = new Map<number, number>();
  for (const bucket of population.scoreBuckets) {
    requireIntegerWithin(bucket.points, 0, MAX_DAILY_NINE_POINTS, 'score bucket points');
    requirePositiveInteger(bucket.count, 'score bucket count');
    scoreCounts.set(bucket.points, (scoreCounts.get(bucket.points) ?? 0) + bucket.count);
  }

  const completionCount = [...scoreCounts.values()].reduce((sum, count) => sum + count, 0);
  const totalPoints = [...scoreCounts.entries()]
    .reduce((sum, [points, count]) => sum + (points * count), 0);
  const accumulators = Array.from(
    { length: DAILY_AT_BAT_COUNT },
    (_, index) => createAtBatAccumulator(index + 1),
  );

  for (const bucket of population.atBatFactBuckets) {
    requireIntegerWithin(bucket.pitchNumber, 1, DAILY_AT_BAT_COUNT, 'pitch number');
    requireIntegerWithin(bucket.hintsRevealed, 0, 4, 'hints revealed');
    requireIntegerWithin(bucket.wrongGuesses, 0, 3, 'wrong guesses');
    requirePositiveInteger(bucket.count, 'at-bat bucket count');
    if (!OUTCOMES.includes(bucket.outcome)) throw new Error('Invalid Daily Nine outcome bucket.');
    if (!RESOLUTIONS.includes(bucket.resolution)) {
      throw new Error('Invalid Daily Nine resolution bucket.');
    }

    const accumulator = accumulators[bucket.pitchNumber - 1]!;
    accumulator.sampleSize += bucket.count;
    accumulator.points += getDailyAtBatPoints({
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      outcome: bucket.outcome,
      hintsRevealed: bucket.hintsRevealed,
      wrongGuesses: bucket.wrongGuesses,
    }) * bucket.count;
    accumulator.hints += bucket.hintsRevealed * bucket.count;
    if (bucket.hintsRevealed > 0) accumulator.hintUsers += bucket.count;
    accumulator.outcomes[bucket.outcome] += bucket.count;
    accumulator.resolutions[bucket.resolution] += bucket.count;
  }

  for (const accumulator of accumulators) {
    if (accumulator.sampleSize !== completionCount) {
      throw new Error(
        `Daily Nine comparison population mismatch at pitch ${accumulator.pitchNumber}: expected ${completionCount}, received ${accumulator.sampleSize}.`,
      );
    }
  }

  return {
    completionCount,
    averageTotalPoints: mean(totalPoints, completionCount),
    scoreDistribution: [...scoreCounts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([points, count]) => ({
        points,
        count,
        rate: ratio(count, completionCount),
      })),
    atBats: accumulators.map(accumulator => ({
      pitchNumber: accumulator.pitchNumber,
      sampleSize: accumulator.sampleSize,
      averagePoints: mean(accumulator.points, accumulator.sampleSize),
      averageHintsRevealed: mean(accumulator.hints, accumulator.sampleSize),
      hintUseRate: ratio(accumulator.hintUsers, accumulator.sampleSize),
      outcomeRates: rateRecord(accumulator.outcomes, accumulator.sampleSize),
      resolutionRates: rateRecord(accumulator.resolutions, accumulator.sampleSize),
    })),
  };
}

type AtBatAccumulator = {
  pitchNumber: number;
  sampleSize: number;
  points: number;
  hints: number;
  hintUsers: number;
  outcomes: Record<DailyOutcome, number>;
  resolutions: Record<DailyAtBatResolution, number>;
};

function createAtBatAccumulator(pitchNumber: number): AtBatAccumulator {
  return {
    pitchNumber,
    sampleSize: 0,
    points: 0,
    hints: 0,
    hintUsers: 0,
    outcomes: {
      HR: 0,
      '3B': 0,
      '2B': 0,
      '1B': 0,
      BB: 0,
      K: 0,
    },
    resolutions: {
      correct: 0,
      strikeout: 0,
      give_up: 0,
    },
  };
}

function rateRecord<T extends string>(
  counts: Record<T, number>,
  total: number,
): Record<T, number> {
  return Object.fromEntries(
    Object.entries(counts).map(([key, count]) => [key, ratio(count as number, total)]),
  ) as Record<T, number>;
}

function mean(sum: number, count: number): number {
  return count === 0 ? 0 : sum / count;
}

function ratio(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
}

function requireIntegerWithin(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be an integer between ${minimum} and ${maximum}.`);
  }
}
