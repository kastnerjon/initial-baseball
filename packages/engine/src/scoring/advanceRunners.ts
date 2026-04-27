import type { AdvancementResult, BaseState } from './baseState.js';

export type NonBuntHitResult = 'single' | 'double' | 'triple' | 'home_run';

export function advanceRunners(bases: BaseState, hitResult: NonBuntHitResult): AdvancementResult {
  switch (hitResult) {
    case 'single':
      return {
        bases: { first: true, second: bases.first, third: bases.second },
        runsScored: bases.third ? 1 : 0,
        outsAdded: 0,
      };
    case 'double':
      return {
        bases: { first: false, second: true, third: bases.first },
        runsScored: Number(bases.second) + Number(bases.third),
        outsAdded: 0,
      };
    case 'triple':
      return {
        bases: { first: false, second: false, third: true },
        runsScored: Number(bases.first) + Number(bases.second) + Number(bases.third),
        outsAdded: 0,
      };
    case 'home_run':
      return {
        bases: { first: false, second: false, third: false },
        runsScored: 1 + Number(bases.first) + Number(bases.second) + Number(bases.third),
        outsAdded: 0,
      };
  }
}
