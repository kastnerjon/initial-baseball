import { expect, it } from 'vitest';
import { advanceRunnersOnSacrifice } from './advanceRunnersOnSacrifice.js';

it.each([
  [{ first: false, second: false, third: false }, { first: false, second: false, third: false }, 0],
  [{ first: true, second: false, third: false }, { first: false, second: true, third: false }, 0],
  [{ first: false, second: true, third: false }, { first: false, second: false, third: true }, 0],
  [{ first: false, second: false, third: true }, { first: false, second: false, third: false }, 1],
  [{ first: true, second: true, third: true }, { first: false, second: true, third: true }, 1],
] as const)('advances runners on SAC from %o to %o and scores %i', (bases, expectedBases, expectedRuns) => {
  expect(advanceRunnersOnSacrifice(bases)).toEqual({
    bases: expectedBases,
    runsScored: expectedRuns,
    outsAdded: 1,
  });
});
