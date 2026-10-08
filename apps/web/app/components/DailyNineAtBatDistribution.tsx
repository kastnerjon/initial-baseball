import type { JSX } from 'react';
import type { DailyNineAtBatComparisonState } from '../dailyNineAtBatComparisonState';
import { createDailyNineAtBatDistributionPresentation } from '../dailyNineAtBatDistributionPresentation';

type SuccessfulAtBat = Extract<DailyNineAtBatComparisonState, { status: 'success' }>;

export function DailyNineAtBatDistribution({ state }: { state: SuccessfulAtBat }): JSX.Element | null {
  const presentation = createDailyNineAtBatDistributionPresentation(state);
  if (presentation === null) return null;

  const accessibleBars = presentation.bars
    .map(bar => `${bar.points} points (${bar.outcome}): ${bar.count} results, ${bar.percent}%`)
    .join('; ');

  return (
    <section className="at-bat-distribution" aria-label="At-bat score distribution">
      <h3>How everyone scored on this at-bat</h3>
      <p className="at-bat-distribution-sample">
        {`Based on ${presentation.sampleSize} other completed result${presentation.sampleSize === 1 ? '' : 's'}`}
      </p>
      <div className="at-bat-distribution-bars" role="img" aria-label={`Score distribution. ${accessibleBars}`}>
        {presentation.bars.map(bar => (
          <div
            key={bar.points}
            className={bar.selected ? 'at-bat-distribution-column at-bat-distribution-selected' : 'at-bat-distribution-column'}
            aria-hidden="true"
          >
            <strong className="at-bat-distribution-percent">{bar.percent}%</strong>
            <div className="at-bat-distribution-track">
              <span className="at-bat-distribution-bar" style={{ height: `${bar.heightPercent}%` }} />
            </div>
            <strong className="at-bat-distribution-points">{bar.points}</strong>
            <span className="at-bat-distribution-outcome">{`(${bar.outcome})`}</span>
          </div>
        ))}
      </div>
      <p className="at-bat-distribution-summary">
        {`You scored more than ${presentation.beatPercent}% of other players on this at-bat.`}
        <span> Ties aren’t counted as beaten.</span>
      </p>
    </section>
  );
}
