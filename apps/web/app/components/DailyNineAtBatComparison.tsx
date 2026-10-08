import type { JSX } from 'react';
import type { DailyNineAtBatComparisonState } from '../dailyNineAtBatComparisonState';
import { DailyNineAtBatDistribution } from './DailyNineAtBatDistribution';

type DailyNineAtBatComparisonProps = {
  state: DailyNineAtBatComparisonState;
};

export function DailyNineAtBatComparison({
  state,
}: DailyNineAtBatComparisonProps): JSX.Element | null {
  if (state.status === 'idle') return null;

  const presentation = createPresentation(state);
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
      {state.status === "success" ? <DailyNineAtBatDistribution state={state} /> : null}
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
    note: `${count} other result${count === 1 ? '' : 's'}${strictLowerAtBatRate === null ? '' : " · ties aren't counted as beaten"}`,
  };
}
