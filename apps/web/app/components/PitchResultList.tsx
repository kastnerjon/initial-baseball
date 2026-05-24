import type { JSX } from 'react';
import type { DailySharePitchLine } from '@initial-baseball/shared';

type PitchResultListProps = {
  pitchLines: DailySharePitchLine[];
  title: string;
  emptyLabel: string;
  compact?: boolean;
};

export function PitchResultList({
  pitchLines,
  title,
  emptyLabel,
  compact = false,
}: PitchResultListProps): JSX.Element {
  if (compact && pitchLines.length > 0) {
    return (
      <details className="pitch-results-card pitch-results-card-compact">
        <summary className="pitch-results-summary">
          <span className="pitch-results-kicker">Scorecard</span>
          <span className="pitch-results-title">{`${pitchLines.length} completed`}</span>
        </summary>
        <PitchList pitchLines={pitchLines} title={title} />
      </details>
    );
  }

  return (
    <section className={compact ? 'pitch-results-card pitch-results-card-compact' : 'pitch-results-card'}>
      <div className="pitch-results-header">
        <span className="pitch-results-kicker">Scorecard</span>
        <h2>{title}</h2>
      </div>
      {pitchLines.length === 0 ? (
        <p className="pitch-results-empty">{emptyLabel}</p>
      ) : (
        <PitchList pitchLines={pitchLines} title={title} />
      )}
    </section>
  );
}

function PitchList({
  pitchLines,
  title,
}: {
  pitchLines: DailySharePitchLine[];
  title: string;
}): JSX.Element {
  return (
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
  );
}
