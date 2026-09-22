import type { JSX } from 'react';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import { createDailyNineCompletedComparisonPresentation } from '../dailyNineCompletedComparisonPresentation';

type DailyNineCompletedComparisonProps = {
  state: DailyNineCompletedComparisonState;
};

export function DailyNineCompletedComparison({
  state,
}: DailyNineCompletedComparisonProps): JSX.Element | null {
  if (state.status === 'idle') return null;

  const presentation = createDailyNineCompletedComparisonPresentation(state);
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
