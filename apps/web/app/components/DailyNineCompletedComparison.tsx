import type { JSX } from 'react';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import { createDailyNineCompletedComparisonPresentation, formatDailyNineCompletedPercentile } from '../dailyNineCompletedComparisonPresentation';
import { formatDailyScorecardPoints } from '../dailyScorecard';
import { formatDailyNinePercentileOrdinal } from '../formatDailyNinePercentileOrdinal';

type DailyNineCompletedComparisonProps = {
  points: number;
  state: DailyNineCompletedComparisonState;
  currentPointsV4?: boolean;
  practiceOnly?: boolean;
};

export function DailyNineCompletedComparison({ points, state, currentPointsV4 = false, practiceOnly = false }: DailyNineCompletedComparisonProps): JSX.Element {
  const presentation = state.status === 'idle' ? null : createDailyNineCompletedComparisonPresentation(state);
  const inclusivePercentile = currentPointsV4 ? formatDailyNineCompletedPercentile(state) : null;

  return (
    <section className="completed-comparison" aria-label={practiceOnly ? 'Practice final score' : 'Final score comparison'} aria-live="polite">
      <div className={practiceOnly ? 'completed-comparison-metrics completed-comparison-metrics-practice' : 'completed-comparison-metrics'}>
        <div className="completed-comparison-tile completed-comparison-tile-score">
          <span className="completed-comparison-label">Final Score</span>
          <div className="completed-comparison-score-line">
            <strong className="completed-comparison-score">{formatDailyScorecardPoints(points)}</strong>
            <span className="completed-comparison-points-unit">PTS</span>
          </div>
        </div>
        {practiceOnly ? null : <>
        <div className="completed-comparison-tile">
          <span className="completed-comparison-label">Average</span>
          <strong className="completed-comparison-value">{presentation?.average ?? '—'}</strong>
        </div>
        <div className="completed-comparison-tile">
          <span className="completed-comparison-label">{currentPointsV4 ? 'Percentile' : 'Beat'}</span>
          <strong className="completed-comparison-value">{currentPointsV4
            ? inclusivePercentile === null ? '—' : formatDailyNinePercentileOrdinal(Number(inclusivePercentile))
            : presentation?.beat ?? '—'}</strong>
          {presentation?.averageStatus ? (
            <span className={'completed-comparison-average-status completed-comparison-performance-' + presentation.averageStatus}>
              {presentation.statusLabel}
            </span>
          ) : null}
        </div>
        </>}
      </div>
      {!practiceOnly && currentPointsV4 ? (
        <div className="completed-comparison-extra">
          <span>BEAT <strong>{presentation?.beat ?? '—'}</strong></span>
          <span>Percentile <strong>{inclusivePercentile === null ? '—' : formatDailyNinePercentileOrdinal(Number(inclusivePercentile))}</strong></span>
        </div>
      ) : null}
      {practiceOnly || presentation === null ? null : <p className="completed-comparison-note">{presentation.note}</p>}
    </section>
  );
}
