import {
  CLASSIC_DAILY_RULESET_VERSION,
  CURRENT_DAILY_RULESET_VERSION,
  type DailyGuessResult,
  type DailyPublicPuzzle,
  type DailyRevealCount,
  type HintType,
} from '@initial-baseball/shared';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';

export type DailyBootstrapRulesetVersion =
  | typeof CURRENT_DAILY_RULESET_VERSION
  | typeof CLASSIC_DAILY_RULESET_VERSION;

export type DailyAuthorizedHint = {
  slot: 1 | 2 | 3 | 4;
  hintType: HintType;
  hintLabel: string;
  hintValue: string;
};

export type DailyHintCheckpoint = {
  revealedCount: DailyRevealCount;
  progressionToken: string;
};

export type DailyHintBundle = {
  pitchNumber: number;
  revealedCount: DailyRevealCount;
  hints: DailyAuthorizedHint[];
  checkpoints: DailyHintCheckpoint[];
};

export type DailyBootstrap = {
  rulesetVersion: DailyBootstrapRulesetVersion;
  puzzle: DailyPublicPuzzle;
  progressionToken: string;
  hintBundle: DailyHintBundle;
};

export type DailyHintResponse = {
  hint: Omit<DailyAuthorizedHint, 'slot'>;
  progressionToken: string;
};

export type DailyHintBundleResponse = {
  hintBundle: DailyHintBundle;
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
  hintBundle: DailyHintBundle | null;
};

export type DailyRuntimeService = {
  getPublicPuzzle: (date: string) => Promise<DailyPublicPuzzle>;
  getBootstrap: (
    date: string,
    rulesetVersion?: DailyBootstrapRulesetVersion,
  ) => Promise<DailyBootstrap>;
  getHintBundle: (progressionToken: string) => Promise<DailyHintBundleResponse>;
  revealHint: (progressionToken: string) => Promise<DailyHintResponse>;
  resolveAtBat: (request: DailyResolutionRequest) => Promise<DailyResolutionResponse>;
};
