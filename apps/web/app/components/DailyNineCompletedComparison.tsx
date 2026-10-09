import type { JSX } from 'react';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import { createDailyNineCompletedComparisonPresentation, formatDailyNineCompletedPercentile } from '../dailyNineCompletedComparisonPresentation';
import { formatDailyScorecardPoints } from '../dailyScorecard';

type DailyNineCompletedComparisonProps = {
  points: number;
  state: DailyNineCompletedComparisonState;
  currentPointsV4?: boolean;
};

export function DailyNineCompletedComparison({ points, state, currentPointsV4 = false }: DailyNineCompletedComparisonProps): JSX.Element {
  const presentation = state.status === 'idle' ? null : createDailyNineCompletedComparisonPresentation(state);

  return (
    <section className="completed-comparison" aria-label="Final score comparison" aria-live="polite">
      <div className="completed-comparison-metrics">
        <div className="completed-comparison-tile completed-comparison-tile-score">
          <span className="completed-comparison-label">Final Score</span>
          <div className="completed-comparison-score-line">
            <strong className="completed-comparison-score">{formatDailyScorecardPoints(points)}</strong>
            <span className="completed-comparison-points-unit">PTS</span>
          </div>
        </div>
        <div className="completed-comparison-tile">
          <span className="completed-comparison-label">Average</span>
          <strong className="completed-comparison-value">{presentation?.average ?? '—'}</strong>
        </div>
        <div className="completed-comparison-tile">
          <span className="completed-comparison-label">{currentPointsV4 ? 'PCTL' : 'Beat'}</span>
          <strong className="completed-comparison-value">{currentPointsV4
            ? formatDailyNineCompletedPercentile(state) ?? '—'
            : presentation?.beat ?? '—'}</strong>
          {presentation?.averageStatus ? (
            <span className={'completed-comparison-average-status completed-comparison-performance-' + presentation.averageStatus}>
              {presentation.statusLabel}
            </span>
          ) : null}
        </div>
      </div>
      {presentation === null ? null : <p className="completed-comparison-note">{presentation.note}</p>}
    </section>
  );
}
