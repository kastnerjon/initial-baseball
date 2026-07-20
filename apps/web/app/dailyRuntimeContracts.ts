import type { DailyGuessResult, DailyPublicPuzzle } from '@initial-baseball/shared';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';

export type DailyPublicSession = {
  puzzle: DailyPublicPuzzle;
  progressionToken: string;
};

export type DailyHintRequest = {
  puzzleDate: string;
  progressionToken: string;
};

export type DailyHintResponse = {
  hint: {
    hintType: 'main_decade' | 'teams' | 'position' | 'stats';
    hintLabel: string;
    hintValue: string;
  };
  progressionToken: string;
};

export type DailyResolutionRequest = {
  puzzleDate: string;
  progressionToken: string;
  submittedPlayerId?: string;
  giveUp?: boolean;
};

export type DailyResolutionResponse = {
  result: DailyGuessResult;
  reveal: CanonicalRevealViewModel | null;
  progressionToken: string | null;
};

export type DailyRuntimeService = {
  getPublicSession: (date: string) => Promise<DailyPublicSession>;
  revealHint: (request: DailyHintRequest) => Promise<DailyHintResponse>;
  resolveAtBat: (request: DailyResolutionRequest) => Promise<DailyResolutionResponse>;
};
