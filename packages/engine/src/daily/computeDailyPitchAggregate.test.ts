import { expect, it } from 'vitest';
import { computeDailyPitchAggregate } from './computeDailyPitchAggregate.js';

it('computes field performance by initials without exposing player names', () => {
  expect(computeDailyPitchAggregate('KGJ', [
    { initials: 'KGJ', outcome: 'HR' },
    { initials: 'KGJ', outcome: '2B' },
    { initials: 'KGJ', outcome: 'K' },
    { initials: 'PM', outcome: 'HR' },
  ])).toEqual({
    initials: 'KGJ',
    attempts: 3,
    hrPct: 33.3,
    triplePct: 0,
    doublePct: 33.3,
    singlePct: 0,
    buntPct: 0,
    strikeoutPct: 33.3,
    averageBases: 2,
  });
});
