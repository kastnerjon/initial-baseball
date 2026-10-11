import type { JSX } from 'react';
import type { DailyScorecardPoints } from '../dailyScorecard';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import { FinalScoreHistogram } from './FinalScoreHistogram';
import { NineAtBatStackedDistribution } from './NineAtBatStackedDistribution';
import { ResultsDisclosure } from './ResultsDisclosure';

export function DailyNineScoreDistributionCharts({ points, comparisons, completedComparison, initials }: {
  points: DailyScorecardPoints;
  comparisons: DailyNineScorecardComparisons;
  completedComparison: DailyNineCompletedComparisonState;
  initials: readonly string[];
}): JSX.Element {
  return (
    <>
      <ResultsDisclosure title="Final Score Distribution">
        <FinalScoreHistogram comparison={completedComparison} showHeading={false} />
      </ResultsDisclosure>
      <ResultsDisclosure title="At-Bat Score Distribution">
        <NineAtBatStackedDistribution points={points} comparisons={comparisons}
          initials={initials} showHeading={false} />
      </ResultsDisclosure>
    </>
  );
}
