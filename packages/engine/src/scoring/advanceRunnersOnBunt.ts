import type { AdvancementResult, BaseState } from './baseState.js';

export function advanceRunnersOnBunt(bases: BaseState): AdvancementResult {
  if (bases.third) {
    return {
      bases: {
        first: true,
        second: bases.first,
        third: bases.second,
      },
      runsScored: 0,
      outsAdded: 1,
    };
  }

  return {
    bases: {
      first: false,
      second: bases.first,
      third: bases.second,
    },
    runsScored: 0,
    outsAdded: 1,
  };
}
