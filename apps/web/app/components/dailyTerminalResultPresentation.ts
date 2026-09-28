import type { DailyOutcome } from '@initial-baseball/shared';
import { formatDailyScorecardPoints } from '../dailyScorecard';

export function createDailyTerminalResultCallout(
  outcome: DailyOutcome,
  awardedPoints: number,
): string {
  const outcomeLabel = outcome === 'HR' ? 'HR!' : outcome;
  const pointsUnit = awardedPoints === 1 ? 'PT' : 'PTS';
  return `${outcomeLabel} ${formatDailyScorecardPoints(awardedPoints)} ${pointsUnit}`;
}
