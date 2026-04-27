import { expect, it } from 'vitest';
import { advanceRunnersOnBunt } from './advanceRunnersOnBunt.js';

it('advances runners one base and adds an out with less than two outs', () => {
  expect(advanceRunnersOnBunt({ first: true, second: true, third: true }, 1)).toEqual({
    bases: { first: false, second: true, third: true },
    runsScored: 1,
    outsAdded: 1,
  });
});

it('with two outs, ends the inning with no advancement or run', () => {
  expect(advanceRunnersOnBunt({ first: true, second: false, third: true }, 2)).toEqual({
    bases: { first: true, second: false, third: true },
    runsScored: 0,
    outsAdded: 1,
  });
});
