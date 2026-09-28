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
import type { DailyNineAtBatComparisonState } from './useDailyNineAtBatComparison';
import type { DailyNineCompletedComparisonState } from './useDailyNineCompletedComparison';
import type {
  DailyNineScorecardComparisonState,
  DailyNineScorecardComparisons,
} from './useDailyNineScorecardComparisons';

type DailyNineInningScoreboardPresentationInput = {
  pitches: Pick<DailyPublicPuzzlePitch, 'pitchNumber' | 'initials'>[];
  currentPitchNumber: number;
  rulesetVersion: DailyRulesetVersion;
  atBatPoints: DailyScorecardPoints;
  atBatComparisons: DailyNineScorecardComparisons;
  activeAtBatComparison: DailyNineAtBatComparisonState;
  activeAtBatResolved: boolean;
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
  activeAtBatComparison,
  activeAtBatResolved,
  totalPoints,
  gameCompleted,
  completedComparison,
}: DailyNineInningScoreboardPresentationInput): InningScoreboardProps {
  const comparisonsSupported = isDailyNineComparisonApiRulesetVersion(rulesetVersion);

  return {
    columns: pitches.map((pitch) => {
      const ownPoints = atBatPoints[pitch.pitchNumber];
      const resolved = ownPoints !== undefined;
      const comparison = pitch.pitchNumber === currentPitchNumber && activeAtBatResolved
        ? toScorecardComparisonState(activeAtBatComparison)
        : atBatComparisons[pitch.pitchNumber];

      return {
        atBatNumber: pitch.pitchNumber,
        initials: pitch.initials,
        current: pitch.pitchNumber === currentPitchNumber,
        user: resolved
          ? createScoreValue(
              formatDailyScorecardPoints(ownPoints),
              `Your score for at-bat ${pitch.pitchNumber}`,
            )
          : createDashValue(`Your score for at-bat ${pitch.pitchNumber} is not resolved yet`),
        average: createAtBatAverageValue(
          pitch.pitchNumber,
          resolved,
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
  resolved: boolean,
  comparisonsSupported: boolean,
  state: DailyNineScorecardComparisonState | undefined,
): InningScoreboardValue {
  if (!resolved) {
    return createDashValue(`Average for at-bat ${pitchNumber} is available after the at-bat is resolved`);
  }
  if (!comparisonsSupported) {
    return createDashValue(`Average for at-bat ${pitchNumber} is unavailable for this scoring version`);
  }
  if (state === undefined || state.status === 'loading') {
    return createDashValue(`Average for at-bat ${pitchNumber} is loading`);
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
    return createDashValue('Completed-game average is loading');
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

function toScorecardComparisonState(
  state: DailyNineAtBatComparisonState,
): DailyNineScorecardComparisonState | undefined {
  if (state.status === 'idle') return undefined;
  if (state.status === 'loading') return { status: 'loading' };
  if (state.status === 'unavailable') return { status: 'unavailable' };
  return {
    status: 'success',
    resolvedAtBatCount: state.resolvedAtBatCount,
    averagePoints: state.averagePoints,
  };
}

function createScoreValue(display: string, label: string): InningScoreboardValue {
  return {
    display,
    accessibleLabel: `${label}: ${display}`,
  };
}

function createDashValue(accessibleLabel: string): InningScoreboardValue {
  return { display: '—', accessibleLabel };
}
