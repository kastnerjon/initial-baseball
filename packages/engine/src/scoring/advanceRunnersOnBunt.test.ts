import { describe, expect, it } from 'vitest';
import { advanceRunnersOnBunt } from './advanceRunnersOnBunt.js';

describe('advanceRunnersOnBunt', () => {
  it('makes the batter out with empty bases', () => {
    expect(advanceRunnersOnBunt({ first: false, second: false, third: false })).toEqual({
      bases: { first: false, second: false, third: false },
      runsScored: 0,
      outsAdded: 1,
    });
  });

  it('advances a runner from first to second while the batter is out', () => {
    expect(advanceRunnersOnBunt({ first: true, second: false, third: false })).toEqual({
      bases: { first: false, second: true, third: false },
      runsScored: 0,
      outsAdded: 1,
    });
  });

  it('advances a runner from second to third while the batter is out', () => {
    expect(advanceRunnersOnBunt({ first: false, second: true, third: false })).toEqual({
      bases: { first: false, second: false, third: true },
      runsScored: 0,
      outsAdded: 1,
    });
  });

  it('puts the batter on first and records the runner on third as out', () => {
    expect(advanceRunnersOnBunt({ first: false, second: false, third: true })).toEqual({
      bases: { first: true, second: false, third: false },
      runsScored: 0,
      outsAdded: 1,
    });
  });

  it('keeps the bases loaded when they start loaded because the runner on third is out', () => {
    expect(advanceRunnersOnBunt({ first: true, second: true, third: true })).toEqual({
      bases: { first: true, second: true, third: true },
      runsScored: 0,
      outsAdded: 1,
    });
  });
});
