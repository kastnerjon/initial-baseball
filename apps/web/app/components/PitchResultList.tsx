import type { JSX } from 'react';
import type { DailyScorecardAnswers } from '../dailyScorecard';
import type { DailySharePitchLine } from '@initial-baseball/shared';

type PitchResultListProps = {
  pitchLines: DailySharePitchLine[];
  title: string;
  emptyLabel: string;
  compact?: boolean;
  answers?: DailyScorecardAnswers;
  summaryMetric?: { label: string; value: string; note: string };
};

export function PitchResultList({
  pitchLines,
  title,
  emptyLabel,
  compact = false,
  answers = {},
  summaryMetric,
}: PitchResultListProps): JSX.Element {
  if (compact && pitchLines.length > 0) {
    return (
      <details className="pitch-results-card pitch-results-card-compact">
        <summary className="pitch-results-summary">
          <span className="pitch-results-kicker">Scorecard</span>
          <span className="pitch-results-title">{`${pitchLines.length} completed`}</span>
        </summary>
        <PitchList pitchLines={pitchLines} title={title} answers={answers} />
      </details>
    );
  }

  return (
    <section className={compact ? 'pitch-results-card pitch-results-card-compact' : 'pitch-results-card'}>
      <div className="pitch-results-header">
        <span className="pitch-results-kicker">Scorecard</span>
        <h2>{title}</h2>
      </div>
      {summaryMetric === undefined ? null : (
        <div className="scorecard-summary-metric" aria-label="Scorecard comparison average">
          <span className="scorecard-summary-label">{summaryMetric.label}</span>
          <strong className="scorecard-summary-value">{summaryMetric.value}</strong>
          <span className="scorecard-summary-note">{summaryMetric.note}</span>
        </div>
      )}
      {pitchLines.length === 0 ? (
        <p className="pitch-results-empty">{emptyLabel}</p>
      ) : (
        <PitchList pitchLines={pitchLines} title={title} answers={answers} />
      )}
    </section>
  );
}

function PitchList({
  pitchLines,
  title,
  answers,
}: {
  pitchLines: DailySharePitchLine[];
  title: string;
  answers: DailyScorecardAnswers;
}): JSX.Element {
  return (
    <ul className="scorecard-list" aria-label={title}>
      {pitchLines.map((line, index) => (
        <li key={`${line.initials}-${line.outcome}-${index}`} className="scorecard-row">
          <span className="pitch-initials">{line.initials}</span>
          <span className="scorecard-answer">{answers[index + 1] ?? 'Answer unavailable'}</span>
          <strong className="pitch-outcome">{line.outcome}</strong>
        </li>
      ))}
    </ul>
  );
}
