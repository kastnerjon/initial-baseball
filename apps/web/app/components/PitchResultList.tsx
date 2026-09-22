import type { JSX } from 'react';
import type { DailySharePitchLine } from '@initial-baseball/shared';
import {
  formatDailyScorecardPoints,
  type DailyScorecardAnswers,
  type DailyScorecardPoints,
} from '../dailyScorecard';
import {
  createDailyNineScorecardAtBatAverage,
} from '../dailyNineScorecardComparisonPresentation';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';

type PitchResultListProps = {
  pitchLines: DailySharePitchLine[];
  title: string;
  emptyLabel: string;
  compact?: boolean;
  answers?: DailyScorecardAnswers;
  points?: DailyScorecardPoints;
  comparisons?: DailyNineScorecardComparisons;
};

export function PitchResultList({
  pitchLines,
  title,
  emptyLabel,
  compact = false,
  answers = {},
  points = {},
  comparisons = {},
}: PitchResultListProps): JSX.Element {
  if (compact && pitchLines.length > 0) {
    return (
      <details className="pitch-results-card pitch-results-card-compact">
        <summary className="pitch-results-summary">
          <span className="pitch-results-kicker">Scorecard</span>
          <span className="pitch-results-title">{`${pitchLines.length} completed`}</span>
        </summary>
        <PitchList
          pitchLines={pitchLines}
          title={title}
          answers={answers}
          points={points}
          comparisons={comparisons}
        />
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
        <PitchList
          pitchLines={pitchLines}
          title={title}
          answers={answers}
          points={points}
          comparisons={comparisons}
        />
      )}
    </section>
  );
}

function PitchList({
  pitchLines,
  title,
  answers,
  points,
  comparisons,
}: {
  pitchLines: DailySharePitchLine[];
  title: string;
  answers: DailyScorecardAnswers;
  points: DailyScorecardPoints;
  comparisons: DailyNineScorecardComparisons;
}): JSX.Element {
  return (
    <ul className="scorecard-list" aria-label={title}>
      {pitchLines.map((line, index) => {
        const pitchNumber = index + 1;
        const average = createDailyNineScorecardAtBatAverage(comparisons[pitchNumber]);
        const awardedPoints = points[pitchNumber];
        const personalScore = awardedPoints === undefined
          ? null
          : formatDailyScorecardPoints(awardedPoints);

        return (
          <li
            key={`${line.initials}-${line.outcome}-${index}`}
            className={personalScore === null ? 'scorecard-row' : 'scorecard-row scorecard-row-points'}
          >
            <span className="pitch-initials">{line.initials}</span>
            <span className="scorecard-answer">{answers[pitchNumber] ?? 'Answer unavailable'}</span>
            {personalScore === null ? (
              <strong className="pitch-outcome">{line.outcome}</strong>
            ) : (
              <>
                <strong className="scorecard-points" aria-label={`Your score ${personalScore}`}>
                  {personalScore}
                </strong>
                <span className="scorecard-average">{average === null ? '' : `AVG ${average}`}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
