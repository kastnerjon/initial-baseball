import type { JSX } from 'react';
import type { DailyNineAtBatComparisonState } from '../dailyNineAtBatComparisonState';
import { DailyNineAtBatDistribution } from './DailyNineAtBatDistribution';
import { createDailyNineAtBatDistributionPresentation } from '../dailyNineAtBatDistributionPresentation';
import { formatDailyScorecardPoints } from '../dailyScorecard';

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
            <span className="completed-comparison-label">BEAT %</span>
            <strong className="completed-comparison-value">{presentation?.beat ?? '—'}</strong>
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

  if (presentation === null) return null;

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
          {presentation.beat === null ? null : (
            <strong className="at-bat-comparison-beat">{`BEAT ${presentation.beat}`}</strong>
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
  beat: string | null;
  averageStatus: 'above' | 'at-or-below' | null;
  statusLabel: string | null;
  note: string;
} {
  if (state.status === 'loading') {
    return {
      average: '…',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Loading comparison…',
    };
  }
  if (state.status === 'unavailable') {
    return {
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Comparison unavailable',
    };
  }

  const { resolvedAtBatCount: count, averagePoints, strictLowerAtBatRate } = state;
  if (count === 0) {
    return {
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Waiting for another result',
    };
  }
  if (averagePoints === null) {
    return {
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Comparison unavailable',
    };
  }

  const aboveAverage = state.ownPoints > averagePoints;
  return {
    average: averagePoints.toFixed(1),
    beat: strictLowerAtBatRate === null ? null : `${Math.round(strictLowerAtBatRate * 100)}%`,
    averageStatus: aboveAverage ? 'above' : 'at-or-below',
    statusLabel: aboveAverage ? 'Above AVG' : 'At or below AVG',
    note: `${count} other result${count === 1 ? '' : 's'}`,
  };
}
