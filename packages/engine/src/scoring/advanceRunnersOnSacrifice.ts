import type { AdvancementResult, BaseState } from './baseState.js';

export function advanceRunnersOnSacrifice(bases: BaseState): AdvancementResult {
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
