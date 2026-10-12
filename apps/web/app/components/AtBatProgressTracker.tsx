import React from 'react';
import type { JSX } from 'react';

export type AtBatProgressTrackerProps = {
  currentAtBat: number;
  totalAtBats?: number;
  completedAtBats: readonly number[];
};

/**
 * Presentation-only ordered progress: no scoring, answers, or session authority.
 * Designed for Daily Nine now and future Custom Nine gameplay.
 */
export function AtBatProgressTracker({
  currentAtBat,
  totalAtBats = 9,
  completedAtBats,
}: AtBatProgressTrackerProps): JSX.Element {
  if (!Number.isInteger(totalAtBats) || totalAtBats < 1 || totalAtBats > 9
    || !Number.isInteger(currentAtBat) || currentAtBat < 1
    || currentAtBat > totalAtBats) {
    throw new Error('Invalid at-bat tracker stage.');
  }
  const completed = new Set(completedAtBats);
  if (completed.size !== completedAtBats.length
    || completedAtBats.some(n => !Number.isInteger(n) || n < 1 || n > currentAtBat)) {
    throw new Error('Invalid completed at-bat tracker positions.');
  }

  return (
    <section className="at-bat-progress" aria-label="At-bat progress">
      <ol className="at-bat-progress-steps">
        {Array.from({ length: totalAtBats }, (_, i) => {
          const number = i + 1;
          const done = completed.has(number);
          const current = number === currentAtBat && !done;
          const status = done ? 'completed' : current ? 'current' : 'upcoming';
          return (
            <li className={`at-bat-progress-step at-bat-progress-step--${status}`} key={number}
              ¶»§q«^