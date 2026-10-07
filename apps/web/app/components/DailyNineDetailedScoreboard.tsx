'use client';

import { useState, type JSX } from 'react';
import type { DailyNineScorecardRow } from '../dailyNineScorecardComparisonPresentation';
import { createDailyNineScorecardAtBatBeat } from '../dailyNineScorecardComparisonPresentation';
import { createDailyNineCompletedComparisonPresentation } from '../dailyNineCompletedComparisonPresentation';
import { formatDailyScorecardPoints, type DailyScorecardAnswers, type DailyScorecardPoints } from '../dailyScorecard';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';

type ScoreboardProps = {
  rows: DailyNineScorecardRow[];
  answers: DailyScorecardAnswers;
  points: DailyScorecardPoints;
  comparisons: DailyNineScorecardComparisons;
  totalPoints: number | undefined;
  completedComparison: DailyNineCompletedComparisonState | undefined;
  compact: boolean;
};

export function DailyNineDetailedScoreboard(props: ScoreboardProps): JSX.Element {
  const [revealAnswers, setRevealAnswers] = useState(false);
  const content = (
    <>
      <div className="daily-nine-detail-header">
        {!props.compact ? <h2>Scoreboard</h2> : null}
        <label className="daily-nine-detail-reveal">
          <span>Reveal answers</span>
          <input
            type="checkbox"
            role="switch"
            checked={revealAnswers}
            onChange={event => setRevealAnswers(event.target.checked)}
          />
        </label>
      </div>
      <DailyNineDetailedScoreboardTable {...props} revealAnswers={revealAnswers} />
    </>
  );

  if (props.compact) {
    return (
      <details className="pitch-results-card pitch-results-card-compact">
        <summary className="pitch-results-summary">
          <span className="pitch-results-kicker">Scoreboard</span>
          <span className="pitch-results-title">{props.rows.length} completed</span>
        </summary>
        {content}
      </details>
    );
  }

  return <section className="pitch-results-card">{content}</section>;
}

export function DailyNineDetailedScoreboardTable({
  rows,
  answers,
  points,
  comparisons,
  revealAnswers,
  totalPoints,
  completedComparison,
}: Omit<ScoreboardProps, 'compact'> & { revealAnswers: boolean }): JSX.Element {
  const summary = completedComparison === undefined || completedComparison.status === 'idle'
    ? null
    : createDailyNineCompletedComparisonPresentation(completedComparison);
  return (
    <div className="daily-nine-detail-scroll" role="region" aria-label="Detailed scores by at-bat" tabIndex={0}>
      <table className="daily-nine-detail-table" aria-label="Daily Nine detailed scoreboard">
        <colgroup><col /><col /><col /><col /><col /></colgroup>
        <thead>
          <tr>
            <th scope="col">AB</th>
            <th scope="col">Player</th>
            <th scope="col">Outcome-Score</th>
            <th scope="col">AVG</th>
            <th scope="col">BEAT %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const beat = createDailyNineScorecardAtBatBeat(
              points[row.pitchNumber], comparisons[row.pitchNumber],
            ) ?? '—';
            return (
              <tr key={row.pitchNumber}>
                <th scope="row">{row.pitchNumber}</th>
                <td>
                  <strong>{row.initials}:</strong>
                  {revealAnswers ? (
                    <span className="daily-nine-detail-answer">
                      {answers[row.pitchNumber] ?? 'Answer unavailable'}
                    </span>
                  ) : null}
                </td>
                <td className="daily-nine-detail-outcome" aria-label={`Outcome ${row.outcome}, score ${row.score}`}>
                  {row.outcome} - {row.score}
                </td>
                <td aria-label={`At-bat average ${row.average}`}>{row.average}</td>
                <td className={beatClass(beat)} aria-label={`At-bat BEAT ${beat}`}>{beat}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">TOTAL</th>
            <td>—</td>
            <td aria-label="Total points">{totalPoints === undefined ? '—' : formatDailyScorecardPoints(totalPoints)}</td>
            <td aria-label="Completed-game average">{summary?.average ?? '—'}</td>
            <td className={beatClass(summary?.beat ?? '—')} aria-label="Completed-game BEAT">
              {summary?.beat ?? '—'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function beatClass(value: string): string {
  if (value === '—') return 'daily-nine-detail-beat-unavailable';
  return value === '0%' ? 'daily-nine-detail-beat-zero' : 'daily-nine-detail-beat-positive';
}
