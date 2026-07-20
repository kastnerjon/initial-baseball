import type { DailyGuessResult, DailyPublicPuzzle, DailyRevealCount } from '@initial-baseball/shared';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';

export type DailyHintResponse = {
  hint: {
    hintType: 'main_decade' | 'teams' | 'position' | 'stats';
    hintLabel: string;
    hintValue: string;
  };
};
export type DailyResolutionRequest = {
  puzzleDate: string;
  pitchNumber: number;
  revealCount: DailyRevealCount;
  strikeCount: number;
  submittedPlayerId?: string;
  giveUp?: boolean;
};

export type DailyResolutionResponse = {
  result: DailyGuessResult;
  reveal: CanonicalRevealViewModel | null;
};

export type DailyRuntimeService = {
  getPublicPuzzle: (date: string) => DailyPublicPuzzle;
  revealHint: (date: string, pitchNumber: number, revealCount: number) => DailyHintResponse;
  resolveAtBat: (request: DailyResolutionRequest) => DailyResolutionResponse;
};
