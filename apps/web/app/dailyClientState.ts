import {
  DEFAULT_DAILY_BASE_STATE,
  DEFAULT_DAILY_SCORE_SUMMARY,
  type DailyGameState,
  type DailyGuessResult,
  type DailyInningState,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';
import type { DailyHintResponse } from './dailyRuntimeContracts';

export type DailyAtBatUiState = {
  query: string;
  selectedPlayerId: string | null;
  revealCount: 0 | 1 | 2 | 3 | 4;
  revealedHints: DailyHintResponse['hint'][];
  strikeCount: number;
  submittedResult: DailyGuessResult | null;
  reveal: CanonicalRevealViewModel | null;
};

export function createInitialDailyInningState(): DailyInningState {
  return {
    inningNumber: 1,
    outs: 0,
    maxOuts: 3,
    bases: { ...DEFAULT_DAILY_BASE_STATE },
    completedAtBats: [],
    currentAtBat: null,
  };
}
export function createInitialDailyGameState(puzzle: DailyPublicPuzzle): DailyGameState {
  return {
    anonymousPlayerId: 'anon-demo',
    status: 'in_progress',
    puzzle,
    inning: createInitialDailyInningState(),
    score: { ...DEFAULT_DAILY_SCORE_SUMMARY },
    completedPitchLines: [],
    shareResult: null,
  };
}

export function createInitialAtBatUiState(): DailyAtBatUiState {
  return {
    query: '',
    selectedPlayerId: null,
    revealCount: 0,
    revealedHints: [],
    strikeCount: 0,
    submittedResult: null,
    reveal: null,
  };
}
