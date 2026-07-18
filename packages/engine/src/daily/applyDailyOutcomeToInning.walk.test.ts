import { describe, expect, it } from 'vitest';
import type { DailyBaseState, DailyInningState, DailyScoreSummary } from '@initial-baseball/shared';
import { applyDailyOutcomeToInning } from './applyDailyOutcomeToInning.js';

const score = (): DailyScoreSummary => ({
  runs: 0,
  hits: 0,
  outs: 0,
  strikeouts: 0,
  completed: false,
});

const inning = (bases: DailyBaseState): DailyInningState => ({
  inningNumber: 1,
  outs: 0,
  maxOuts: 3,
  bases,
  completedAtBats: [],
  currentAtBat: null,
});

const applyWalk = (bases: DailyBaseState) =>
  applyDailyOutcomeToInning({
    outcome: 'BB',
    inning: inning(bases),
    score: score(),
  });

describe('walk advancement', () => {
  it.each([
    {
      label: 'empty bases',
      before: { first: false, second: false, third: false },
      after: { first: true, second: false, third: false },
      runs: 0,
    },
    {
      label: 'runner on first',
      before: { first: true, second: false, third: false },
      after: { first: true, second: true, third: false },
      runs: 0,
    },
    {
      label: 'runner on second',
      before: { first: false, second: true, third: false },
      after: { first: true, second: true, third: false },
      runs: 0,
    },
    {
      label: 'runner on third',
      before: { first: false, second: false, third: true },
      after: { first: true, second: false, third: true },
      runs: 0,
    },
    {
      label: 'runners on first and second',
      before: { first: true, second: true, third: false },
      after: { first: true, second: true, third: true },
      runs: 0,
    },
    {
      label: 'runners on first and third',
      before: { first: true, second: false, third: true },
      after: { first: true, second: true, third: true },
      runs: 0,
    },
    {
      label: 'runners on second and third',
      before: { first: false, second: true, third: true },
      after: { first: true, second: true, third: true },
      runs: 0,
    },
    {
      label: 'bases loaded',
      before: { first: true, second: true, third: true },
      after: { first: true, second: true, third: true },
      runs: 1,
    },
  ] satisfies Array<{ label: string; before: DailyBaseState; after: DailyBaseState; runs: number }>)('$label', ({ before, after, runs }) => {
    const result = applyWalk(before);

    expect(result.inning.bases).toEqual(after);
    expect(result.score).toMatchObject({
      runs,
      hits: 0,
      outs: 0,
      strikeouts: 0,
      completed: false,
    });
  });
});
