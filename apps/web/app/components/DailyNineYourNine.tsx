'use client';

import { useState, type JSX } from 'react';
import { getDailyPointsRange } from '@initial-baseball/engine';
import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { createDailyNineCompletedComparisonPresentation } from '../dailyNineCompletedComparisonPresentation';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import type { DailyNineScorecardRow } from '../dailyNineScorecardComparisonPresentation';
import { formatDailyScorecardPoints, type DailyScorecardAnswers, type DailyScorecardPoints } from '../dailyScorecard';

const MAX_POINTS_PER_AT_BAT = getDailyPointsRange(POINTS_V4_DAILY_RULESET_VERSION, 1)?.maximumPoints ?? 0;

export type DailyNineYourNineProps = {
  rows: DailyNineScorecardRow[];
  answers: DailyScorecardAnswers;
  points: DailyScorecardPoints;
  totalPoints: number;
  puzzleNumber?: number;
  totalAtBats: number;
  completedComparison?: DailyNineCompletedComparisonState;
  currentAtBatNumber?: number | null;
  currentAtBatInitials?: string;
};

export function DailyNineYourNine(props: DailyNineYourNineProps): JSX.Element {
  const [revealPlayers, setRevealPlayers] = useState(false);
  const gameAverage = props.completedComparison === undefined || props.completedComparison.status === 'idle'
    ? null : createDailyNineCompletedComparisonPresentation(props.completedComparison).average;
  return (
    <section className="your-nine" aria-label="Your Nine at-bat results">
      <div className="your-nine-header">
        <div className="your-nine-title-group">
          {props.puzzleNumber === undefined ? null : (
            <span className="your-nine-kicker">{`DAILY #${props.puzzleNumber}`}</span>
          )}
          <h2>Your Nine</h2>
          <span className="your-nine-progress">
            {`${props.rows.length} of ${props.totalAtBats} completed`}
          </span>
          {props.currentAtBatNumber !== undefined && gameAverage !== null ? (
            <span className="your-nine-progress">{`GAME AVG ${gameAverage}`}</span>
          ) : null}
        </div>
        <div className="your-nine-total">
          <strong>{formatDailyScorecardPoints(props.totalPoints)} <span>PTS</span></strong>
        </div>
      </div>
      <div className="your-nine-controls">
        <label className="daily-nine-detail-reveal">
          <span>Reveal players</span>
          <input
            type="checkbox"
            role="switch"
            checked={revealPlayers}
            onChange={() => setRevealPlayers(current => !current)}
          />
        </label>
      </div>
      <DailyNineYourNineRows {...props} revealPlayers={revealPlayers} />
    </section>
  );
}

export function DailyNineYourNineRows({
  rows, answers, points, totalAtBats, currentAtBatNumber, currentAtBatInitials, revealPlayers,
}: DailyNineYourNineProps & { revealPlayers: boolean }): JSX.Element {
  const remainingStart = Math.max(rows.length + 1, (currentAtBatNumber ?? 0) + 1);
  const remaining = Math.max(0, totalAtBats - remainingStart + 1);

  return (
    <div className="your-nine-list">
      {rows.map(row => {
        const awardedPoints = points[row.pitchNumber];
        const hasAverage = row.average !== '—' && row.score !== '—';
        const status = !hasAverage ? 'pending'
          : Number(row.score) > Number(row.average) ? 'above' : 'at-or-below';
        const fill = awardedPoints === undefined || MAX_POINTS_PER_AT_BAT <= 0 ? 0
          : Math.min(100, Math.max(0, (awardedPoints / MAX_POINTS_PER_AT_BAT) * 100));
        const answer = revealPlayers ? answers[row.pitchNumber] : undefined;

        return (
          <div key={row.pitchNumber} className={`your-nine-row your-nine-row-${status}`}>
            <span className="your-nine-ab">{String(row.pitchNumber).padStart(2, '0')}</span>
            <div className="your-nine-row-main">
              <div className="your-nine-result-line">
                <div className="your-nine-player">
                  <strong>{row.initials}</strong>
                  {answer === undefined ? null : (
                    <>
                      <span className="your-nine-answer-separator"> - </span>
                      <span className="your-nine-answer">{answer}</span>
                    </>
                  )}
                </div>
                <div className="your-nine-outcome">
                  <strong>{row.outcome}</strong>
                  <span>{`${row.score} PTS`}</span>
                </div>
              </div>
              <div className="your-nine-comparison">
                <span className="your-nine-avg">{`AVG ${row.average}`}</span>
                <div className="your-nine-track" aria-hidden="true">
                  <div className="your-nine-fill" style={{ width: `${fill}%` }} />
                </div>
                <strong className="your-nine-beat">{`BEAT ${row.beat}`}</strong>
              </div>
            </div>
          </div>
        );
      })}
      {currentAtBatNumber !== undefined && currentAtBatNumber !== null ? (
        <div className="your-nine-active" aria-current="step">
          <span className="your-nine-ab">{String(currentAtBatNumber).padStart(2, '0')}</span>
          <strong>{currentAtBatInitials ?? 'Now batting'}</strong>
          <span>NOW BATTING</span>
        </div>
      ) : null}
      {remaining > 0 ? (
        <p className="your-nine-upcoming">
          <span>{`${String(remainingStart).padStart(2, '0')}${remaining > 1 ? `–${String(totalAtBats).padStart(2, '0')}` : ''}`}</span>
          <span>Upcoming</span>
        </p>
      ) : null}
    </div>
  );
}
