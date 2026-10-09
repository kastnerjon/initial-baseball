import type { JSX } from 'react';
import type { DailyNineDistributionPresentation } from '../dailyNineAtBatDistributionPresentation';

export function DailyNineAtBatDistribution({
  presentation,
  average,
}: {
  presentation: DailyNineDistributionPresentation;
  average: string;
}): JSX.Element {

  const accessibleBars = presentation.bars
    .map(bar => `${bar.points} points (${bar.outcome}): ${bar.count} result${bar.count === 1 ? '' : 's'}, ${bar.percent}%${bar.selected ? ', your score' : ''}`)
    .join('; ');

  return (
    <section className="at-bat-distribution" aria-label="At-bat score distribution">
      <h3>How everyone scored on this at-bat</h3>
      <p className="at-bat-distribution-sample">
        {`Average: ${average} pts · Based on ${presentation.sampleSize} other result${presentation.sampleSize === 1 ? '' : 's'}`}
      </p>
      <p className="at-bat-distribution-key">Percent / results</p>
      <div className="at-bat-distribution-bars" role="img" aria-label={`Score distribution. ${accessibleBars}`}>
        {presentation.bars.map(bar => (
          <div
            key={bar.points}
            className={bar.selected ? 'at-bat-distribution-column at-bat-distribution-selected' : 'at-bat-distribution-column'}
            aria-hidden="true"
          >
            <div className="at-bat-distribution-frequency">
              <strong className="at-bat-distribution-percent">{bar.percent}%</strong>
              <span className="at-bat-distribution-count">{`${bar.count} result${bar.count === 1 ? '' : 's'}`}</span>
            </div>
            <div className="at-bat-distribution-track">
              <span className="at-bat-distribution-bar" style={{ height: `${bar.heightPercent}%` }} />
            </div>
            <strong className="at-bat-distribution-points">{bar.points}</strong>
            <span className="at-bat-distribution-outcome">{`(${bar.outcome})`}</span>
            <span className="at-bat-distribution-you">{bar.selected ? 'YOU' : ''}</span>
          </div>
        ))}
      </div>
      <p className="at-bat-distribution-summary">
        {`PCTL ${presentation.percentile} · Your score was at or above ${presentation.percentile}% of other results (ties count).`}
      </p>
    </section>
  );
}
