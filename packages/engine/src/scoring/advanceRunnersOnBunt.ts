import type { AdvancementResult, BaseState } from './baseState.js';

export function advanceRunnersOnBunt(bases: BaseState, outsBeforePlay: number): AdvancementResult {
  if (outsBeforePlay >= 2) {
    return {
      bases,
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
    runsScored: bases.third ? 1 : 0,
    outsAdded: 1,
  };
}
