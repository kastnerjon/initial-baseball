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
  comparisonsEnabled?: boolean;
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
  comparisonsEnabled = true,
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
          comparisonsEnabled,
          comparisonsSupported,
          comparison,
        ),
      };
    }),
    totalUser: createScoreValue(formatDailyScorecardPoints(totalPoints), 'Your total score'),
    totalAverage: createTotalAverageValue(
      comparisonsEnabled,
      comparisonsSupported,
      gameCompleted,
      completedComparison,
    ),
  };
}

function createAtBatAverageValue(
  pitchNumber: number,
  comparisonsEnabled: boolean,
  comparisonsSupported: boolean,
  state: DailyNineScorecardComparisonState | undefined,
): InningScoreboardValue {
  if (!comparisonsEnabled) {
    return createDashValue(`Average for at-bat ${pitchNumber} is unavailable for this game`);
  }
  if (!comparisonsSupported) {
    return createDashValue(`Average for at-bat ${pitchNumber} is unavailable for this scoring version`);
  }
  if (state === undefined || state.status === 'loading') {
    return createLoadingValue(`Average for at-bat ${pitchNumber} is loading`);
  }
  if (state.status === 'unavailable' || state.averagePoints === null) {
    return createDashValue(`Average for at-bat ${pitchNumber} is unavailable`);
  }
  if (state.resolvedAtBatCount === 0) {
    return createDashValue(
      `Average for at-bat ${pitchNumber} is waiting for another result`,
    );
  }

  const display = state.averagePoints.toFixed(1);
  const resultLabel = `${state.resolvedAtBatCount} other result${state.resolvedAtBatCount === 1 ? '' : 's'}`;
  return createScoreValue(
    display,
    `At-bat ${pitchNumber} average from ${resultLabel}`,
  );
}

function createTotalAverageValue(
  comparisonsEnabled: boolean,
  comparisonsSupported: boolean,
  gameCompleted: boolean,
  state: DailyNineCompletedComparisonState,
): InningScoreboardValue {
  if (!comparisonsEnabled) {
    return createDashValue('Completed-game average is unavailable for this game');
  }
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
