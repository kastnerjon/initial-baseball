import type { JSX } from 'react';
import type { DailySharePitchLine } from '@initial-baseball/shared';
import type { DailyScorecardAnswers, DailyScorecardPoints } from '../dailyScorecard';
import {
  createDailyNineScorecardRows,
} from '../dailyNineScorecardComparisonPresentation';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import { DailyNineDetailedScoreboard } from './DailyNineDetailedScoreboard';

type PitchResultListProps = {
  pitchLines: DailySharePitchLine[];
  title: string;
  emptyLabel: string;
  compact?: boolean;
  answers?: DailyScorecardAnswers;
  points?: DailyScorecardPoints;
  comparisons?: DailyNineScorecardComparisons;
  totalPoints?: number;
  completedComparison?: DailyNineCompletedComparisonState;
};

export function PitchResultList({
  pitchLines,
  title,
  emptyLabel,
  compact = false,
  answers = {},
  points,
  comparisons = {},
  totalPoints,
  completedComparison,
}: PitchResultListProps): JSX.Element {
  const dailyNineRows = points === undefined
    ? null
    : createDailyNineScorecardRows(pitchLines, points, comparisons);

  if (dailyNineRows !== null) {
    return <DailyNineDetailedScoreboard
      rows={dailyNineRows}
      answers={answers}
      points={points!}
      comparisons={comparisons}
      totalPoints={totalPoints}
      completedComparison={completedComparison}
      compact={compact}
    />;
  }

  if (compact && pitchLines.length > 0) {
    return (
      <details className="pitch-results-card pitch-results-card-compact">
        <summary className="pitch-results-summary">
          <span className="pitch-results-kicker">Scorecard</span>
          <span className="pitch-results-title">{`${pitchLines.length} completed`}</span>
        </summary>
        <ClassicPitchList pitchLines={pitchLines} title={title} answers={answers} />
      </details>
    );
  }

  return (
    <section className={compact ? 'pitch-results-card pitch-results-card-compact' : 'pitch-results-card'}>
      <div className="pitch-results-header">
        <span className="pitch-results-kicker">Scorecard</span>
        <h2>{title}</h2>
      </div>
      {pitchLines.length === 0 ? (
        <p className="pitch-results-empty">{emptyLabel}</p>
      ) : (
        <ClassicPitchList pitchLines={pitchLines} title={title} answers={answers} />
      )}
    </section>
  );
}

function ClassicPitchList({
  pitchLines,
  title,
  answers,
}: {
  pitchLines: DailySharePitchLine[];
  title: string;
  answers: DailyScorecardAnswers;
}): JSX.Element {
  return (
    <ul className="scorecard-list" aria-label={title}>
      {pitchLines.map((line, index) => {
        const pitchNumber = index + 1;
        return (
          <li key={`${line.initials}-${line.outcome}-${index}`} className="scorecard-row">
            <span className="pitch-initials">{line.initials}</span>
            <span className="scorecard-answer">{answers[pitchNumber] ?? 'Answer unavailable'}</span>
            <strong className="pitch-outcome">{line.outcome}</strong>
          </li>
        );
      })}
    </ul>
  );
}
