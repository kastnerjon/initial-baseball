import type { HintConfigSlot } from './gameSettings.js';

export type DailyPuzzleStatus = 'draft' | 'published' | 'archived';

export type DailyOutcome = 'HR' | '3B' | '2B' | '1B' | 'BUNT' | 'K';

export type DailySharePitchLine = {
  initials: string;
  outcome: DailyOutcome;
};

export type DailyShareResult = {
  puzzleNumber: number;
  runs: number;
  hits: number;
  outs: number;
  pitchLines: DailySharePitchLine[];
  url: string;
};

export type DailyPitchAggregate = {
  initials: string;
  attempts: number;
  hrPct: number;
  triplePct: number;
  doublePct: number;
  singlePct: number;
  buntPct: number;
  strikeoutPct: number;
  averageBases: number;
};

export const DEFAULT_DAILY_HINT_CONFIG: HintConfigSlot[] = [
  { slot: 1, result: 'triple', hintType: 'main_decade', displayLabel: 'Main decade played in' },
  { slot: 2, result: 'double', hintType: 'teams', displayLabel: 'Teams' },
  { slot: 3, result: 'single', hintType: 'position', displayLabel: 'Position' },
  { slot: 4, result: 'bunt', hintType: 'stats', displayLabel: 'Stats' },
];
