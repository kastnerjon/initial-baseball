'use client';

import { useEffect, useId, useState, type JSX } from 'react';
import { getDailyPointsRange } from '@initial-baseball/engine';
import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { createDailyNineCompletedComparisonPresentation } from '../dailyNineCompletedComparisonPresentation';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import type { DailyNineScorecardRow } from '../dailyNineScorecardComparisonPresentation';
import { formatDailyScorecardPoints, type DailyScorecardAnswers, type DailyScorecardPoints } from '../dailyScorecard';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';
import { createDailyNineAtBatComparisonState } from '../dailyNineAtBatComparisonState';
import { createDailyNineAtBatDistributionPresentation } from '../dailyNineAtBatDistributionPresentation';
import { DailyNineAtBatDistribution } from './DailyNineAtBatDistribution';

const MAX_POINTS_PER_AT_BAT = getDailyPointsRange(POINTS_V4_DAILY_RULESET_VERSION, 1)?.maximumPoints ?? 0;

export type DailyNineYourNineProps = {
  rows: DailyNineScorecardRow[];
  answers: DailyScorecardAnswers;
  points: DailyScorecardPoints;
  comparisons: DailyNineScorecardComparisons;
  totalPoints: number;
  puzzleNumber?: number;
  totalAtBats: number;
  completedComparison?: DailyNineCompletedComparisonState;
  currentAtBatNumber?: number | null;
  currentAtBatInitials?: string;
};

export function DailyNineYourNine(props: DailyNineYourNineProps): JSX.Element {
  const [revealPlayers, setRevealPlayers] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();
  const gameAverage = props.completedComparison === undefined || props.completedComparison.status === 'idle'
    ? null : createDailyNineCompletedComparisonPresentation(props.completedComparison).average;
  return (
    <section className="your-nine" aria-label="Your Nine at-bat results">
      <button
        type="button"
        className="your-nine-header"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded(current => !current)}
      >
        <span className="your-nine-title-group">
          {props.puzzleNumber === undefined ? null : (
            <span className="your-nine-kicker">{`DAILY #${props.puzzleNumber}`}</span>
          )}
          <span className="your-nine-heading" role="heading" aria-level={2}>Your Nine</span>
          <span className="your-nine-progress">
            {`${props.rows.length} of ${props.totalAtBats} completed`}
          </span>
          {props.currentAtBatNumber !== undefined && gameAverage !== null ? (
            <span className="your-nine-progress">{`GAME AVG ${gameAverage}`}</span>
          ) : null}
        </span>
        <span className="your-nine-total">
          <strong>{formatDailyScorecardPoints(props.totalPoints)} <span>PTS</span></strong>
        </span>
        <span className="your-nine-disclosure-icon" aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      <div id={bodyId} className="your-nine-body" hidden={!expanded}>
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
      </div>
    </section>
  );
}

export function DailyNineYourNineRows({
  rows, answers, points, comparisons, totalAtBats, currentAtBatNumber, currentAtBatInitials, revealPlayers,
  initialExpandedAtBat = null,
}: DailyNineYourNineProps & { revealPlayers: boolean; initialExpandedAtBat?: number | null }): JSX.Element {
  const [expandedAtBat, setExpandedAtBat] = useState<number | null>(initialExpandedAtBat);
  const distributionId = useId();
  // A local-game reset must not reopen a previously selected row on replay.
  useEffect(() => {
    if (expandedAtBat !== null && !rows.some(row => row.pitchNumber === expandedAtBat)) {
      setExpandedAtBat(null);
    }
  }, [expandedAtBat, rows]);
  const remainingStart = Math.max(rows.length + 1, (currentAtBatNumber ?? 0) + 1);
  const remaining = Math.max(0, totalAtBats - remainingStart + 1);

  return (
    <div className="your-nine-list">
      {rows.map(row => {
        const awardedPoints = points[row.pitchNumber];
        const comparison = comparisons[row.pitchNumber];
        const rawAverage = comparison?.status === 'success' && comparison.resolvedAtBatCount > 0
          ? comparison.averagePoints : null;
        const status = rawAverage === null || awardedPoints === undefined ? 'pending'
          : awardedPoints > rawAverage ? 'above' : 'at-or-below';
        const fill = awardedPoints === undefined || MAX_POINTS_PER_AT_BAT <= 0 ? 0
          : Math.min(100, Math.max(0, (awardedPoints / MAX_POINTS_PER_AT_BAT) * 100));
        const answer = revealPlayers ? answers[row.pitchNumber] : undefined;
        const expanded = expandedAtBat === row.pitchNumber;
        const accessibleAverage = row.average === '—' ? 'unavailable' : `${row.average} points`;
        const accessibleBeat = row.beat === '—' ? 'unavailable' : row.beat;
        const panelId = `${distributionId}-distribution-${row.pitchNumber}`;
        const state = expanded
          ? createDailyNineAtBatComparisonState(comparison, awardedPoints ?? null)
          : null;
        const distribution = state?.status === 'success'
          ? createDailyNineAtBatDistributionPresentation(state)
          : null;

        return (
          <div key={row.pitchNumber} className={`your-nine-row your-nine-row-${status}`}>
            <button
              type="button"
              className="your-nine-row-toggle"
              aria-expanded={expanded}
              aria-controls={expanded ? panelId : undefined}
              aria-label={`At-bat ${row.pitchNumber}: ${row.initials}${answer ? ` - ${answer}` : ''}, ${row.outcome}, ${row.score} points, average ${accessibleAverage}, beat ${accessibleBeat}. ${expanded ? 'Hide' : 'Show'} score distribution`}
              onClick={() => setExpandedAtBat(current => current === row.pitchNumber ? null : row.pitchNumber)}
            >
              <span className="your-nine-ab">{String(row.pitchNumber).padStart(2, '0')}</span>
              <span className="your-nine-row-main">
                <span className="your-nine-result-line">
                  <span className="your-nine-player">
                    <strong>{row.initials}</strong>
                    {answer === undefined ? null : (
                      <>
                        <span className="your-nine-answer-separator"> - </span>
                        <span className="your-nine-answer">{answer}</span>
                      </>
                    )}
                  </span>
                  <span className="your-nine-outcome">
                    <strong>{row.outcome}</strong>
                    <span>{`${row.score} PTS`}</span>
                  </span>
                </span>
                <span className="your-nine-comparison">
                  <span className="your-nine-avg">{`AVG ${row.average}`}</span>
                  <span className="your-nine-track" aria-hidden="true">
                    <span className="your-nine-fill" style={{ width: `${fill}%` }} />
                  </span>
                  <strong className="your-nine-beat">{`BEAT ${row.beat}`}</strong>
                </span>
              </span>
              <span className="your-nine-expand-icon" aria-hidden="true">{expanded ? '−' : '+'}</span>
            </button>
            {expanded ? (
              <div id={panelId} className="your-nine-distribution" role="region" aria-label={`At-bat ${row.pitchNumber} score distribution`}>
                {distribution === null ? (
                  <p className="your-nine-distribution-unavailable" role="status">
                    {state?.status === 'loading'
                      ? 'Loading score distribution…'
                      : state?.status === 'success' && state.resolvedAtBatCount === 0
                        ? 'Waiting for another player’s result.'
                        : 'Score distribution unavailable for this at-bat.'}
                  </p>
                ) : (
                  <DailyNineAtBatDistribution presentation={distribution} average={row.average} />
                )}
              </div>
            ) : null}
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
