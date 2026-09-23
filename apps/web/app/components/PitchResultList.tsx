import type { JSX } from 'react';
import type { DailySharePitchLine } from '@initial-baseball/shared';
import type { DailyScorecardAnswers, DailyScorecardPoints } from '../dailyScorecard';
import {
  createDailyNineScorecardRows,
  type DailyNineScorecardRow,
} from '../dailyNineScorecardComparisonPresentation';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';

type PitchResultListProps = {
  pitchLines: DailySharePitchLine[];
  title: string;
  emptyLabel: string;
  compact?: boolean;
  answers?: DailyScorecardAnswers;
  points?: DailyScorecardPoints;
  comparisons?: DailyNineScorecardComparisons;
};

export function PitchResultList({
  pitchLines,
  title,
  emptyLabel,
  compact = false,
  answers = {},
  points,
  comparisons = {},
}: PitchResultListProps): JSX.Element {
  const dailyNineRows = points === undefined
    ? null
    : createDailyNineScorecardRows(pitchLines, points, comparisons);

  if (compact && pitchLines.length > 0) {
    return (
      <details className="pitch-results-card pitch-results-card-compact">
        <summary className="pitch-results-summary">
          <span className="pitch-results-kicker">Scorecard</span>
          <span className="pitch-results-title">{`${pitchLines.length} completed`}</span>
        </summary>
        {dailyNineRows === null ? (
          <ClassicPitchList pitchLines={pitchLines} title={title} answers={answers} />
        ) : (
          <DailyNineScorecardTable rows={dailyNineRows} title={title} answers={answers} />
        )}
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
      ) : dailyNineRows === null ? (
        <ClassicPitchList pitchLines={pitchLines} title={title} answers={answers} />
      ) : (
        <DailyNineScorecardTable rows={dailyNineRows} title={title} answers={answers} />
      )}
    </section>
  );
}

function DailyNineScorecardTable({
  rows,
  title,
  answers,
}: {
  rows: DailyNineScorecardRow[];
  title: string;
  answers: DailyScorecardAnswers;
}): JSX.Element {
  return (
    <table className="daily-nine-scorecard-table" aria-label={title}>
      <colgroup>
        <col className="daily-nine-scorecard-initials-column" />
        <col className="daily-nine-scorecard-player-column" />
        <col className="daily-nine-scorecard-number-column" />
        <col className="daily-nine-scorecard-number-column" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" aria-label="At-bat" />
          <th scope="col">Player</th>
          <th scope="col">Score</th>
          <th scope="col">Avg</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.pitchNumber}>
            <th scope="row">{`${row.initials}:`}</th>
            <td className="daily-nine-scorecard-player">
              {answers[row.pitchNumber] ?? 'Answer unavailable'}
            </td>
            <td aria-label={`Your score ${row.score}`}>{row.score}</td>
            <td aria-label={`Average score ${row.average}`}>{row.average}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ClassicPitchList({
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
      {pitchLines.map((line, index) => {
        const pitchNumber = index + 1;
        return (
          <li key={`${line.initials}-${line.outcome}-${index}`} className="scorecard-row">
            <span className="pitch-initials">{line.initials}</span>
            <span className="scorecard-answer">{answers[pitchNumber] ?? 'Answer unavailable'}</span>
            <strong className="pitch-outcome">{line.outcome}</strong>
          </li>
        );
      })}
    </ul>
  );
}
