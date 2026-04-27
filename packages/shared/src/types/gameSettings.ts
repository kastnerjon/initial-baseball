import type { StatsHintConfig } from './stats.js';

export type HintType = 'main_decade' | 'teams' | 'position' | 'stats';

export type HitResult = 'triple' | 'double' | 'single' | 'bunt';

export type HintConfigSlot = {
  slot: 1 | 2 | 3 | 4;
  result: HitResult;
  hintType: HintType;
  displayLabel: string;
};

export type GameSettings = {
  innings: number;
  strikesPerAtBat: number;
  outsPerHalfInning: number;
  extrasGhostRunner: boolean;
  hintConfig: HintConfigSlot[];
  statsHintConfig: StatsHintConfig;
};

export const DEFAULT_ALPHA_SETTINGS: GameSettings = {
  innings: 3,
  strikesPerAtBat: 3,
  outsPerHalfInning: 3,
  extrasGhostRunner: true,
  hintConfig: [
    { slot: 1, result: 'triple', hintType: 'main_decade', displayLabel: 'Main decade played in' },
    { slot: 2, result: 'double', hintType: 'teams', displayLabel: 'Teams' },
    { slot: 3, result: 'single', hintType: 'position', displayLabel: 'Position' },
    { slot: 4, result: 'bunt', hintType: 'stats', displayLabel: 'Stats' },
  ],
  statsHintConfig: {
    hitter: ['bwar', 'hr', 'rbi', 'ba', 'obp', 'sb'],
    pitcher: ['bwar', 'w', 'l', 'era', 'whip', 'k'],
  },
};
