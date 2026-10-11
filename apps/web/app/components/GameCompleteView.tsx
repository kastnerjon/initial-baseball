import type { JSX } from 'react';
import { isDailyPointsRulesetVersion, POINTS_V4_DAILY_RULESET_VERSION, type DailyCompletedAtBat, type DailyPublicPuzzle, type DailyShareResult } from '@initial-baseball/shared';
import { PitchResultList } from './PitchResultList';
import { DailyShareCard } from './DailyShareCard';
import { DailyNineLeaderboard } from './DailyNineLeaderboard';
import type { DailyScorecardAnswers, DailyScorecardPoints } from '../dailyScorecard';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';
import { createDailyNineScorecardShareText } from '../dailyNineScorecardComparisonPresentation';
import { DailyNineCompletedComparison } from './DailyNineCompletedComparison';
import { ScoreLine } from './ScoreLine';
import { DailyNineScoreDistributionCharts } from './DailyNineScoreDistributionCharts';
import { ResultsDisclosure } from './ResultsDisclosure';
import { InningScoreboard, type InningScoreboardProps } from './InningScoreboard';
import { isYourNineEnabled } from '../dailyNineYourNineLayout';

type GameCompleteViewProps = {
  shareResult: DailyShareResult;
  shareText: string;
  scorecardAnswers?: DailyScorecardAnswers;
  atBatPoints?: DailyScorecardPoints;
  comparison?: DailyNineCompletedComparisonState;
  atBatComparisons?: DailyNineScorecardComparisons;
  inningScoreboard?: InningScoreboardProps;
  onResetToday?: () => void;
  leaderboard?: {
    puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
    completedAtBats: DailyCompletedAtBat[];
    attemptId: string | null;
  } | undefined;
};

export function GameCompleteView({
  shareResult,
  shareText,
  scorecardAnswers = {},
  atBatPoints = {},
  comparison = { status: 'idle' },
  atBatComparisons = {},
  inningScoreboard,
  onResetToday,
  leaderboard,
}: GameCompleteViewProps): JSX.Element {
  const isPointsGame = isDailyPointsRulesetVersion(shareResult.rulesetVersion);
  const performanceLayout = isYourNineEnabled(shareResult.rulesetVersion);
  const shareCardText = isPointsGame
    ? createDailyNineScorecardShareText(
        shareText,
        shareResult.points.points,
        comparison,
        shareResult.pitchLines,
        atBatPoints,
        atBatComparisons,
        shareResult.rulesetVersion,
      )
    : shareText;

  return (
    <div className="game-shell">
      {performanceLayout ? (
        <ResultsDisclosure title="Summary">
          <section className="complete-card complete-card-daily">
            <h2>{'Daily #' + shareResult.puzzleNumber}</h2>
            <DailyNineCompletedComparison points={shareResult.points.points}
              state={comparison} currentPointsV4 />
          </section>
        </ResultsDisclosure>
      ) : (
        <section className={isPointsGame ? 'complete-card complete-card-daily' : 'complete-card'}>
          <h2>{isPointsGame ? 'Daily #' + shareResult.puzzleNumber : 'Game Complete'}</h2>
          {isPointsGame ? (
            <DailyNineCompletedComparison points={shareResult.points.points} state={comparison} />
          ) : (
            <ScoreLine summary={shareResult.summary} />
          )}
        </section>
      )}
      {!performanceLayout && inningScoreboard !== undefined ? <InningScoreboard {...inningScoreboard} /> : null}
      <PitchResultList
        answers={scorecardAnswers}
        {...(performanceLayout ? {
          performanceLayout,
          puzzleNumber: shareResult.puzzleNumber,
          totalAtBats: shareResult.points.totalAtBats,
        } : {})}
        {...(isPointsGame ? {
          points: atBatPoints,
          totalPoints: shareResult.points.points,
          completedComparison: comparison,
        } : {})}
        comparisons={atBatComparisons}
        pitchLines={shareResult.pitchLines}
        title={isPointsGame ? 'Scoreboard' : 'At-bat Results'}
        emptyLabel="No at-bat results were recorded."
      />
      {leaderboard === undefined ? null : (
        <ResultsDisclosure title="Top 10">
          <DailyNineLeaderboard {...leaderboard} showHeading={false} />
        </ResultsDisclosure>
      )}
      {shareResult.rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION ? (
        <DailyNineScoreDistributionCharts
          points={atBatPoints} comparisons={atBatComparisons}
          completedComparison={comparison}
          initials={shareResult.pitchLines.map(line => line.initials)}
        />
      ) : null}
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
