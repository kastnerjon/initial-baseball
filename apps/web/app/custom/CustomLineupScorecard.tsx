import React, { type JSX } from 'react';
import { getDailyAtBatPoints } from '@initial-baseball/engine';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { CustomLineupV2PublicAtBat } from '../customLineupV2BrowserTransport';

type Props = {
  atBats: readonly CustomLineupV2PublicAtBat[];
  completedAtBats: readonly DailyCompletedAtBat[];
  currentPitch: number | null;
};

/** Presentation-only; points come from the existing points-v4 engine. */
export function CustomLineupScorecard({
  atBats, completedAtBats, currentPitch,
}: Props): JSX.Element {
  const score = completedAtBats.reduce((sum, fact) =>
    sum + getDailyAtBatPoints({ ...fact, rulesetVersion: 'points-v4' }), 0);
  return (
    <section className="custom-lineup-scorecard" aria-label="Lineup scorecard">
      <header className="custom-lineup-scorecard-heading">
        <div><span className="custom-lineup-kicker">Scorecard</span>
          <h2>Your lineup</h2></div>
        <div className="custom-lineup-total" aria-live="polite">
          <strong>{score}</strong><span> / {4 * atBats.length} pts</span>
        </div>
      </header>
      <ol className="custom-lineup-score-rows">
        {atBats.map((pitch, index) => {
          const fact = completedAtBats[index];
          const active = currentPitch === pitch.pitchNumber;
          const earned = fact
            ? getDailyAtBatPoints({ ...fact, rulesetVersion: 'points-v4' }) : null;
          return (
            <li key={pitch.pitchNumber}
              className={active ? 'custom-lineup-score-row is-current'
                : fact ? 'custom-lineup-score-row is-complete' : 'custom-lineup-score-row'}
              aria-current={active ? 'step' : undefined}>
              <span className="custom-lineup-batter-number">{String(pitch.pitchNumber).padStart(2, '0')}</span>
              <strong className="custom-lineup-batter-initials">{pitch.initials}</strong>
              <span className="custom-lineup-batter-outcome">
                {fact ? fact.outcome : active ? 'At bat' : '—'}
              </span>
              <span className="custom-lineup-batter-points">{earned === null ? '—' : earned}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
