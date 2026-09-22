import type { JSX } from 'react';
import { isDailyPointsRulesetVersion, type DailyShareResult } from '@initial-baseball/shared';
import { PitchResultList } from './PitchResultList';
import { DailyShareCard } from './DailyShareCard';
import type { DailyScorecardAnswers, DailyScorecardPoints } from '../dailyScorecard';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';
import { createDailyNineScorecardShareText } from '../dailyNineScorecardComparisonPresentation';
import { DailyNineCompletedComparison } from './DailyNineCompletedComparison';
import { ScoreLine } from './ScoreLine';

type GameCompleteViewProps = {
  shareResult: DailyShareResult;
  shareText: string;
  scorecardAnswers?: DailyScorecardAnswers;
  atBatPoints?: DailyScorecardPoints;
  comparison?: DailyNineCompletedComparisonState;
  atBatComparisons?: DailyNineScorecardComparisons;
  onResetToday?: () => void;
};

export function GameCompleteView({
  shareResult,
  shareText,
  scorecardAnswers = {},
  atBatPoints = {},
  comparison = { status: 'idle' },
  atBatComparisons = {},
  onResetToday,
}: GameCompleteViewProps): JSX.Element {
  const shareCardText = createDailyNineScorecardShareText(
    shareText,
    atBatPoints,
    atBatComparisons,
  );

  return (
    <div className="game-shell">
      <section className="complete-card">
        <h2>Game Complete</h2>
        {isDailyPointsRulesetVersion(shareResult.rulesetVersion) ? (
          <div className="score-line" aria-label="Final Daily score">
            <span>{`${shareResult.points.points}/${shareResult.points.maximumPoints} PTS`}</span>
            <span>{`${shareResult.points.atBatsCompleted}/${shareResult.points.totalAtBats} AB`}</span>
            <span>{`${shareResult.summary.strikeouts} K`}</span>
          </div>
        ) : (
          <ScoreLine summary={shareResult.summary} />
        )}
        <DailyNineCompletedComparison state={comparison} />
      </section>
      <PitchResultList
        answers={scorecardAnswers}
        points={atBatPoints}
        comparisons={atBatComparisons}
        pitchLines={shareResult.pitchLines}
        title="At-bat Results"
        emptyLabel="No at-bat results were recorded."
      />
      <DailyShareCard shareText={shareCardText} />
      {onResetToday !== undefined ? (
        <button
          type="button"
          className="reset-local-result-button"
          onClick={onResetToday}
        >
          Reset today's local result
        </button>
      ) : null}
    </div>
  );
}
