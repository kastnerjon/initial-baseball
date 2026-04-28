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
      <h2>{title}</h2>
      {pitchLines.length === 0 ? (
        <p className="pitch-results-empty">{emptyLabel}</p>
      ) : (
        <ul className="pitch-list" aria-label={title}>
          {pitchLines.map((line, index) => (
            <li key={`${line.initials}-${line.outcome}-${index}`} className="pitch-row">
              <span className="pitch-initials">{line.initials}</span>
              <strong>{line.outcome}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
