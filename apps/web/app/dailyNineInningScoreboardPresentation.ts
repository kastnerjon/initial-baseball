import {
  isDailyNineComparisonApiRulesetVersion,
  type DailyPublicPuzzlePitch,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import type {
  InningScoreboardProps,
  InningScoreboardValue,
} from './components/InningScoreboard';
import { createDailyNineCompletedComparisonPresentation } from './dailyNineCompletedComparisonPresentation';
import {
  formatDailyScorecardPoints,
  type DailyScorecardPoints,
} from './dailyScorecard';
import type { DailyNineCompletedComparisonState } from './useDailyNineCompletedComparison';
import type {
  DailyNineScorecardComparisonState,
  DailyNineScorecardComparisons,
} from './useDailyNineScorecardComparisons';

type DailyNineInningScoreboardPresentationInput = {
  pitches: Pick<DailyPublicPuzzlePitch, 'pitchNumber' | 'initials'>[];
  currentPitchNumber: number | null;
  rulesetVersion: DailyRulesetVersion;
  atBatPoints: DailyScorecardPoints;
  atBatComparisons: DailyNineScorecardComparisons;
  totalPoints: number;
  gameCompleted: boolean;
  completedComparison: DailyNineCompletedComparisonState;
};

export function createDailyNineInningScoreboardPresentation({
  pitches,
  currentPitchNumber,
  rulesetVersion,
  atBatPoints,
  atBatComparisons,
  totalPoints,
  gameCompleted,
  completedComparison,
}: DailyNineInningScoreboardPresentationInput): InningScoreboardProps {
  const comparisonsSupported = isDailyNineComparisonApiRulesetVersion(rulesetVersion);

  return {
    columns: pitches.map((pitch) => {
      const ownPoints = atBatPoints[pitch.pitchNumber];
      const resolved = ownPoints !== undefined;
      const comparison = atBatComparisons[pitch.pitchNumber];

      return {
        atBatNumber: pitch.pitchNumber,
        initials: pitch.initials,
        current: currentPitchNumber !== null && pitch.pitchNumber === currentPitchNumber,
        user: resolved
          ? createScoreValue(
              formatDailyScorecardPoints(ownPoints),
              `Your score for at-bat ${pitch.pitchNumber}`,
            )
          : createDashValue(`Your score for at-bat ${pitch.pitchNumber} is not resolved yet`),
        average: createAtBatAverageValue(
          pitch.pitchNumber,
          comparisonsSupported,
          comparison,
        ),
      };
    }),
    totalUser: createScoreValue(formatDailyScorecardPoints(totalPoints), 'Your total score'),
    totalAverage: createTotalAverageValue(
      comparisonsSupported,
      gameCompleted,
      completedComparison,
    ),
  };
}

function createAtBatAverageValue(
  pitchNumber: number,
  comparisonsSupported: boolean,
  state: DailyNineScorecardComparisonState | undefined,
): InningScoreboardValue {
  if (!comparisonsSupported) {
    return createDashValue(`Average for at-bat ${pitchNumber} is unavailable for this scoring version`);
  }
  if (state === undefined || state.status === 'loading') {
    return createLoadingValue(`Average for at-bat ${pitchNumber} is loading`);
  }
  if (state.status === 'unavailable' || state.averagePoints === null) {
    return createDashValue(`Average for at-bat ${pitchNumber} is unavailable`);
  }
  if (state.resolvedAtBatCount <= 1) {
    const resultLabel = state.resolvedAtBatCount === 1 ? '1 result' : 'no results';
    return createDashValue(
      `Average for at-bat ${pitchNumber} is waiting for more results; ${resultLabel}`,
    );
  }

  const display = state.averagePoints.toFixed(1);
  const sampleLabel = state.resolvedAtBatCount < 10 ? 'early average from' : 'average from';
  return createScoreValue(
    display,
    `At-bat ${pitchNumber} ${sampleLabel} ${state.resolvedAtBatCount} results`,
  );
}

function createTotalAverageValue(
  comparisonsSupported: boolean,
  gameCompleted: boolean,
  state: DailyNineCompletedComparisonState,
): InningScoreboardValue {
  if (!comparisonsSupported) {
    return createDashValue('Completed-game average is unavailable for this scoring version');
  }
  if (!gameCompleted) {
    return createDashValue('Completed-game average is available after all at-bats are resolved');
  }
  if (state.status === 'idle' || state.status === 'loading') {
    return createLoadingValue('Completed-game average is loading');
  }

  const presentation = createDailyNineCompletedComparisonPresentation(state);
  if (presentation.average === '—') {
    return createDashValue(`Completed-game average: ${presentation.note}`);
  }

  return createScoreValue(
    presentation.average,
    `Completed-game average. ${presentation.note}`,
  );
}

function createScoreValue(display: string, label: string): InningScoreboardValue {
  return {
    display,
    accessibleLabel: `${label}: ${display}`,
  };
}

function createLoadingValue(accessibleLabel: string): InningScoreboardValue {
  return { display: '…', accessibleLabel };
}

function createDashValue(accessibleLabel: string): InningScoreboardValue {
  return { display: '—', accessibleLabel };
}
