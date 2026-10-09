import type { JSX } from 'react';
import type { DailyNineAtBatComparisonState } from '../dailyNineAtBatComparisonState';
import { DailyNineAtBatDistribution } from './DailyNineAtBatDistribution';
import { createDailyNineAtBatDistributionPresentation } from '../dailyNineAtBatDistributionPresentation';
import { formatDailyScorecardPoints } from '../dailyScorecard';
import { getDailyNineInclusiveAtBatPercentile } from '@initial-baseball/daily/comparison';

type DailyNineAtBatComparisonProps = {
  state: DailyNineAtBatComparisonState;
  /** Present only for resolved points-v4 play; comparison data may still be loading. */
  summaryPoints?: number;
  summaryOutcome?: string;
};

export function DailyNineAtBatComparison({
  state, summaryPoints, summaryOutcome,
}: DailyNineAtBatComparisonProps): JSX.Element | null {
  if (state.status === 'idle' && summaryPoints === undefined) return null;

  const presentation = state.status === 'idle' ? null : createPresentation(state);
  const distribution = state.status === 'success'
    ? createDailyNineAtBatDistributionPresentation(state)
    : null;

  if (summaryPoints !== undefined) {
    return (
      <section className="at-bat-comparison at-bat-comparison-tiles" aria-label="At-bat comparison" aria-live="polite">
        <div className="completed-comparison-metrics at-bat-summary-metrics" aria-label="Your at-bat performance">
          <div className="completed-comparison-tile completed-comparison-tile-score">
            <span className="completed-comparison-label">Your Score</span>
            <strong className="completed-comparison-score">{formatDailyScorecardPoints(summaryPoints)}</strong>
            {summaryOutcome === undefined ? null : <span className="sr-only">{`Outcome: ${summaryOutcome}`}</span>}
          </div>
          <div className="completed-comparison-tile">
            <span className="completed-comparison-label">AVG</span>
            <strong className="completed-comparison-value">{presentation?.average ?? '—'}</strong>
          </div>
          <div className="completed-comparison-tile">
            <span className="completed-comparison-label">PCTL</span>
            <strong className="completed-comparison-value">{presentation?.percentile ?? '—'}</strong>
          </div>
        </div>
        {distribution !== null ? (
          <DailyNineAtBatDistribution presentation={distribution} average={presentation?.average ?? '—'} />
        ) : (
          <p className="at-bat-comparison-note">{presentation?.note ?? 'Loading comparison…'}</p>
        )}
      </section>
    );
  }

  // Narrow the historical fallback to states with authoritative ownPoints.
  if (state.status === 'idle' || presentation === null) return null;

  if (distribution !== null) {
    return (
      <section className="at-bat-comparison" aria-label="At-bat comparison" aria-live="polite">
        <DailyNineAtBatDistribution presentation={distribution} average={presentation?.average ?? '—'} />
      </section>
    );
  }

  return (
    <section className="at-bat-comparison" aria-label="At-bat comparison" aria-live="polite">
      <div className="at-bat-comparison-values">
        <span className="at-bat-comparison-metric">
          <span className="at-bat-comparison-label">YOU</span>
          <strong className="at-bat-comparison-value">{state.ownPoints}</strong>
        </span>
        <span className="at-bat-comparison-metric">
          <span className="at-bat-comparison-label">AVG</span>
          <strong className="at-bat-comparison-value">{presentation.average}</strong>
        </span>
      </div>
      {presentation.averageStatus === null ? null : (
        <div className={`at-bat-comparison-performance at-bat-comparison-performance-${presentation.averageStatus}`}>
          {presentation.percentile === null ? null : (
            <strong className="at-bat-comparison-beat">{`PCTL ${presentation.percentile}`}</strong>
          )}
          <span className="at-bat-comparison-average-status">{presentation.statusLabel}</span>
        </div>
      )}
      <p className="at-bat-comparison-note">{presentation.note}</p>
    </section>
  );
}

function createPresentation(
  state: Exclude<DailyNineAtBatComparisonState, { status: 'idle' }>,
): {
  average: string;
  percentile: string | null;
  averageStatus: 'above' | 'at-or-below' | null;
  statusLabel: string | null;
  note: string;
} {
  if (state.status === 'loading') {
    return {
      average: '…',
      percentile: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Loading comparison…',
    };
  }
  if (state.status === 'unavailable') {
    return {
      average: '—',
      percentile: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Comparison unavailable',
    };
  }

  const { resolvedAtBatCount: count, averagePoints } = state;
  if (count === 0) {
    return {
      average: '—',
      percentile: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Waiting for another result',
    };
  }
  if (averagePoints === null) {
    return {
      average: '—',
      percentile: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Comparison unavailable',
    };
  }

  const aboveAverage = state.ownPoints > averagePoints;
  return {
    average: averagePoints.toFixed(1),
    percentile: getDisplayPercentile(state),
    averageStatus: aboveAverage ? 'above' : 'at-or-below',
    statusLabel: aboveAverage ? 'Above AVG' : 'At or below AVG',
    note: `${count} other result${count === 1 ? '' : 's'}`,
  };
}

function getDisplayPercentile(
  state: Extract<DailyNineAtBatComparisonState, { status: 'success' }>,
): string | null {
  if (state.rulesetVersion === undefined || state.scoreHistogram === undefined) return null;
  const rate = getDailyNineInclusiveAtBatPercentile({
    rulesetVersion: state.rulesetVersion,
    resolvedAtBatCount: state.resolvedAtBatCount,
    scoreHistogram: state.scoreHistogram,
  }, state.ownPoints);
  return rate === null ? null : String(Math.round(rate * 100));
}
