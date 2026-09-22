import type { JSX } from 'react';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import { createDailyNineCompletedComparisonPresentation } from '../dailyNineCompletedComparisonPresentation';
import { formatDailyScorecardPoints } from '../dailyScorecard';

type DailyNineCompletedComparisonProps = {
  points: number;
  state: DailyNineCompletedComparisonState;
};

export function DailyNineCompletedComparison({
  points,
  state,
}: DailyNineCompletedComparisonProps): JSX.Element {
  const presentation = state.status === 'idle'
    ? null
    : createDailyNineCompletedComparisonPresentation(state);
  const average = presentation?.average === '—' ? null : presentation?.average ?? null;

  return (
    <section className="completed-comparison" aria-label="Final score comparison" aria-live="polite">
      <div className="completed-comparison-headline">
        <strong className="completed-comparison-score">{`${formatDailyScorecardPoints(points)} PTS`}</strong>
        {average === null ? null : (
          <>
            <span className="completed-comparison-separator" aria-hidden="true">•</span>
            <span className="completed-comparison-average">{`AVG ${average}`}</span>
          </>
        )}
      </div>
      {presentation?.beat === null || presentation?.beat === undefined ? null : (
        <strong className="completed-comparison-beat">{`BEAT ${presentation.beat}`}</strong>
      )}
      {presentation === null ? null : (
        <p className="completed-comparison-note">{presentation.note}</p>
      )}
    </section>
  );
}
