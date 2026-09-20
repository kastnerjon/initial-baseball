import type { JSX } from 'react';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';

type DailyNineCompletedComparisonProps = {
  state: DailyNineCompletedComparisonState;
};

export function DailyNineCompletedComparison({
  state,
}: DailyNineCompletedComparisonProps): JSX.Element | null {
  if (state.status === 'idle') return null;

  const presentation = createPresentation(state);
  return (
    <section className="completed-comparison" aria-label="Final score comparison" aria-live="polite">
      <div className="completed-comparison-values">
        <Metric label="YOU" value={String(state.ownPoints)} />
        <Metric label="AVG" value={presentation.average} />
        {presentation.beat === null ? null : <Metric label="BEAT" value={presentation.beat} />}
      </div>
      <p className="completed-comparison-note">{presentation.note}</p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span className="completed-comparison-metric">
      <span className="completed-comparison-label">{label}</span>
      <strong className="completed-comparison-value">{value}</strong>
    </span>
  );
}

function createPresentation(
  state: Exclude<DailyNineCompletedComparisonState, { status: 'idle' }>,
): { average: string; beat: string | null; note: string } {
  if (state.status === 'loading') {
    return { average: '—', beat: null, note: 'Loading comparison…' };
  }
  if (state.status === 'unavailable') {
    return { average: '—', beat: null, note: 'Comparison unavailable' };
  }

  const { completedGameCount: count, averageTotalPoints, strictLowerFinishRate } = state;
  if (count <= 1) {
    return {
      average: '—',
      beat: null,
      note: count === 0
        ? 'Waiting for more completed results'
        : 'Waiting for more completed results · 1 result',
    };
  }
  if (averageTotalPoints === null) {
    return { average: '—', beat: null, note: 'Comparison unavailable' };
  }

  const average = averageTotalPoints.toFixed(1);
  if (count < 10) {
    return { average, beat: null, note: `Early average · ${count} completed results` };
  }
  if (count < 20) {
    return { average, beat: null, note: `${count} completed results · BEAT appears at 20` };
  }

  return {
    average,
    beat: strictLowerFinishRate === null ? null : `${Math.round(strictLowerFinishRate * 100)}%`,
    note: `${count} completed results · ties aren't counted as beaten`,
  };
}
