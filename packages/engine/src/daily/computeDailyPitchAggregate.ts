import type { DailyOutcome, DailyPitchAggregate } from '@initial-baseball/shared';

export type DailyPitchOutcomeRecord = {
  initials: string;
  outcome: DailyOutcome;
};

const BASE_VALUES: Record<DailyOutcome, number> = {
  HR: 4,
  '3B': 3,
  '2B': 2,
  '1B': 1,
  BUNT: 0,
  K: 0,
};

function pct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export function computeDailyPitchAggregate(initials: string, records: DailyPitchOutcomeRecord[]): DailyPitchAggregate {
  const matching = records.filter((record) => record.initials === initials);
  const attempts = matching.length;
  const count = (outcome: DailyOutcome) => matching.filter((record) => record.outcome === outcome).length;
  const totalBases = matching.reduce((sum, record) => sum + BASE_VALUES[record.outcome], 0);

  return {
    initials,
    attempts,
    hrPct: pct(count('HR'), attempts),
    triplePct: pct(count('3B'), attempts),
    doublePct: pct(count('2B'), attempts),
    singlePct: pct(count('1B'), attempts),
    buntPct: pct(count('BUNT'), attempts),
    strikeoutPct: pct(count('K'), attempts),
    averageBases: attempts === 0 ? 0 : Math.round((totalBases / attempts) * 100) / 100,
  };
}
