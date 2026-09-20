import type { JSX } from 'react';
import type { DailyNineAtBatComparisonState } from '../useDailyNineAtBatComparison';

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
      <p className="at-bat-comparison-note">{presentation.note}</p>
    </section>
  );
}

function createPresentation(
  state: Exclude<DailyNineAtBatComparisonState, { status: 'idle' }>,
): { average: string; note: string } {
  if (state.status === 'loading') return { average: '—', note: 'Loading comparison…' };
  if (state.status === 'unavailable') return { average: '—', note: 'Comparison unavailable' };

  const { resolvedAtBatCount: count, averagePoints } = state;
  if (count <= 1) {
    return {
      average: '—',
      note: count === 0 ? 'Waiting for more results' : 'Waiting for more results · 1 result',
    };
  }
  if (averagePoints === null) return { average: '—', note: 'Comparison unavailable' };

  return {
    average: averagePoints.toFixed(1),
    note: count < 10 ? `Early average · ${count} results` : `${count} results`,
  };
}
