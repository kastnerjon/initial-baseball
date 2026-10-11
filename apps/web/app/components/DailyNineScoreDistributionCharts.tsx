import type { JSX } from 'react';
import type { DailyScorecardPoints } from '../dailyScorecard';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import { FinalScoreHistogram } from './FinalScoreHistogram';
import { NineAtBatStackedDistribution } from './NineAtBatStackedDistribution';

export function DailyNineScoreDistributionCharts({ points, comparisons, completedComparison }: {
  points: DailyScorecardPoints;
  comparisons: DailyNineScorecardComparisons;
  completedComparison: DailyNineCompletedComparisonState;
}): JSX.Element {
  return (
    <>
      <FinalScoreHistogram comparison={completedComparison} />
      <NineAtBatStackedDistribution points={points} comparisons={comparisons} />
    </>
  );
}
