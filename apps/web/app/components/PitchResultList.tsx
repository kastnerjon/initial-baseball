import type { JSX } from 'react';
import type { DailySharePitchLine } from '@initial-baseball/shared';

type PitchResultListProps = {
  pitchLines: DailySharePitchLine[];
  title: string;
  emptyLabel: string;
};

export function PitchResultList({ pitchLines, title, emptyLabel }: PitchResultListProps): JSX.Element {
  return (
    <section className="pitch-results-card">
      <div className="pitch-results-header">
        <span className="pitch-results-kicker">Scorecard</span>
        <h2>{title}</h2>
      </div>
      {pitchLines.length === 0 ? (
        <p className="pitch-results-empty">{emptyLabel}</p>
      ) : (
        <ul className="pitch-list" aria-label={title}>
          {pitchLines.map((line, index) => (
            <li key={`${line.initials}-${line.outcome}-${index}`} className="pitch-row">
              <span className="pitch-row-chip">
                <span className="pitch-initials">{line.initials}</span>
                <strong className="pitch-outcome">{line.outcome}</strong>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
