import type { DailyGuessResult, DailyPublicPuzzle } from '@initial-baseball/shared';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';

export type DailyBootstrap = {
  puzzle: DailyPublicPuzzle;
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
  progressionToken: string;
  submittedPlayerId?: string;
  giveUp?: boolean;
};

export type DailyResolutionResponse = {
  result: DailyGuessResult;
  reveal: CanonicalRevealViewModel | null;
  progressionToken: string;
};

export type DailyRuntimeService = {
  getBootstrap: (date: string) => DailyBootstrap;
  revealHint: (progressionToken: string) => DailyHintResponse;
  resolveAtBat: (request: DailyResolutionRequest) => DailyResolutionResponse;
};
