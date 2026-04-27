import { DEFAULT_ALPHA_SETTINGS, type HintConfigSlot, type HintType } from './gameSettings.js';
import type { PlayerIdentity } from './player.js';
import type { StatsHintConfig } from './stats.js';

export type DailyPuzzleStatus = 'draft' | 'published' | 'archived';
export type DailyGameStatus = 'not_started' | 'in_progress' | 'completed';

export type DailyOutcome = 'HR' | '3B' | '2B' | '1B' | 'BUNT' | 'K';
export type DailyRevealCount = 0 | HintConfigSlot['slot'];
export type DailyGuessSource = 'initials' | HintConfigSlot['slot'] | 'strikeout';
export type DailyHintConfig = HintConfigSlot[];

export type DailyScoringMapping = Record<DailyGuessSource, DailyOutcome>;

export type DailySharePitchLine = {
  initials: string;
  outcome: DailyOutcome;
};

export type DailyScoreSummary = {
  runs: number;
  hits: number;
  outs: number;
  strikeouts: number;
  completed: boolean;
};

export type DailyShareResult = {
  summary: DailyScoreSummary;
  puzzleNumber: number;
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

export type DailyPitchHintSet = Partial<Record<HintType, string>>;

export type DailyPuzzlePitch = {
  pitchNumber: number;
  player: PlayerIdentity;
  hints: DailyPitchHintSet;
};

export type DailyPuzzle = {
  id: string;
  puzzleNumber: number;
  puzzleDate: string;
  status: DailyPuzzleStatus;
  hintConfig: DailyHintConfig;
  statsHintConfig: StatsHintConfig;
  pitches: DailyPuzzlePitch[];
};

export type DailyHintReveal = {
  slot: HintConfigSlot['slot'];
  hintType: HintType;
  displayLabel: string;
  revealed: boolean;
  value: string | null;
};

export type DailyHintRevealState = {
  revealedCount: DailyRevealCount;
  nextSlot: HintConfigSlot['slot'] | null;
  hints: DailyHintReveal[];
};

export type DailyGuessResult =
  | {
      kind: 'incorrect';
      revealedCount: DailyRevealCount;
      strikeCount: number;
      remainingStrikes: number;
    }
  | {
      kind: 'correct';
      revealedCount: DailyRevealCount;
      outcome: Exclude<DailyOutcome, 'K'>;
      source: Exclude<DailyGuessSource, 'strikeout'>;
    }
  | {
      kind: 'strikeout';
      revealedCount: DailyRevealCount;
      strikeCount: number;
      outcome: 'K';
      source: 'strikeout';
    };

export type DailyAtBatState = {
  pitchNumber: number;
  player: PlayerIdentity;
  strikes: number;
  maxStrikes: number;
  hintState: DailyHintRevealState;
  guesses: DailyGuessResult[];
  outcome: DailyOutcome | null;
  completed: boolean;
};

export type DailyBaseState = {
  first: boolean;
  second: boolean;
  third: boolean;
};

export type DailyInningState = {
  inningNumber: 1;
  outs: number;
  maxOuts: number;
  bases: DailyBaseState;
  completedAtBats: DailyAtBatState[];
  currentAtBat: DailyAtBatState | null;
};

export type DailyGameState = {
  anonymousPlayerId: string;
  status: DailyGameStatus;
  puzzle: DailyPuzzle;
  inning: DailyInningState;
  score: DailyScoreSummary;
  completedPitchLines: DailySharePitchLine[];
  shareResult: DailyShareResult | null;
};

export const DEFAULT_DAILY_SCORING: DailyScoringMapping = {
  initials: 'HR',
  1: '3B',
  2: '2B',
  3: '1B',
  4: 'BUNT',
  strikeout: 'K',
};

export const DEFAULT_DAILY_HINT_CONFIG: DailyHintConfig = DEFAULT_ALPHA_SETTINGS.hintConfig.map((slot) => ({ ...slot }));

export const DEFAULT_DAILY_STATS_HINT_CONFIG: StatsHintConfig = {
  hitter: [...DEFAULT_ALPHA_SETTINGS.statsHintConfig.hitter],
  pitcher: [...DEFAULT_ALPHA_SETTINGS.statsHintConfig.pitcher],
};

export const DEFAULT_DAILY_SCORE_SUMMARY: DailyScoreSummary = {
  runs: 0,
  hits: 0,
  outs: 0,
  strikeouts: 0,
  completed: false,
};

export const DEFAULT_DAILY_BASE_STATE: DailyBaseState = {
  first: false,
  second: false,
  third: false,
};

export const DEFAULT_DAILY_HINT_TYPES: HintType[] = [
  'main_decade',
  'teams',
  'position',
  'stats',
];
