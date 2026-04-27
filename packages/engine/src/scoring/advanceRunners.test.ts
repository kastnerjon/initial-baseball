import { expect, it } from 'vitest';
import { advanceRunners } from './advanceRunners.js';

it('advances runners on a single', () => {
  expect(advanceRunners({ first: true, second: true, third: true }, 'single')).toEqual({
    bases: { first: true, second: true, third: true },
    runsScored: 1,
    outsAdded: 0,
  });
});

it('advances runners on a double', () => {
  expect(advanceRunners({ first: true, second: true, third: true }, 'double')).toEqual({
    bases: { first: false, second: true, third: true },
    runsScored: 2,
    outsAdded: 0,
  });
});

it('advances runners on a triple', () => {
  expect(advanceRunners({ first: true, second: true, third: true }, 'triple')).toEqual({
    bases: { first: false, second: false, third: true },
    runsScored: 3,
    outsAdded: 0,
  });
});

it('scores batter and all runners on a home run', () => {
  expect(advanceRunners({ first: true, second: false, third: true }, 'home_run')).toEqual({
    bases: { first: false, second: false, third: false },
    runsScored: 3,
    outsAdded: 0,
  });
});
