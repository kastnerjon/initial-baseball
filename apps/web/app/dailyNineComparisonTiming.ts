import 'server-only';

export const DAILY_NINE_COMPARISON_TIMING_STAGES = [
  'compose',
  'puzzle',
  'provider',
  'provider-setup',
  'provider-rpc',
  'provider-decode',
] as const;

export type DailyNineComparisonTimingStage =
  typeof DAILY_NINE_COMPARISON_TIMING_STAGES[number];

export type DailyNineComparisonStageTimings =
  Partial<Record<DailyNineComparisonTimingStage, number>>;

export async function measureDailyNineComparisonStage<T>(
  timings: DailyNineComparisonStageTimings,
  stage: DailyNineComparisonTimingStage,
  operation: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const startedAt = now();
  try {
    return await operation();
  } finally {
    timings[stage] = Math.max(0, now() - startedAt);
  }
}

export function measureDailyNineComparisonSyncStage<T>(
  timings: DailyNineComparisonStageTimings,
  stage: DailyNineComparisonTimingStage,
  operation: () => T,
  now: () => number = Date.now,
): T {
  const startedAt = now();
  try {
    return operation();
  } finally {
    timings[stage] = Math.max(0, now() - startedAt);
  }
}
