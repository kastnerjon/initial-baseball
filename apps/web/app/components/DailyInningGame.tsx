'use client';

import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createDailyShareResult, formatDailyShareText, type PlayerSearchResult } from '@initial-baseball/engine';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  isDailyPointsRulesetVersion,
  type DailyAtBatResolution,
  type DailyGameState,
  type DailyGuessResult,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import { type PendingAtBatAdvance, resolveDailyTerminalAtBat } from '../dailyAtBatResolution';
import { revealNextHintFromBundle } from '../dailyHintBundle';
import type { LoadedSavedDailyGame, SavedDailyGame } from '../dailyLocalStorage';
import { createDailySavedGameRestoreController } from '../dailySavedGameRestoreController';
import { useDailyGameplayPersistence } from '../useDailyGameplayPersistence';
import { createDailyShareUrl } from '../dailyShareUrl';
import type { CanonicalRevealViewModel } from '../canonicalRevealViewModel';
import { type DailyAtBatUiState, createInitialAtBatUiState, createInitialDailyGameState } from '../dailyClientState';
import type {
  DailyBootstrapRulesetVersion,
  DailyHintBundle,
} from '../dailyRuntimeContracts';
import { createDailyScorecardPoints, type DailyScorecardAnswers } from '../dailyScorecard';
import { createDailyNineInningScoreboardPresentation } from '../dailyNineInningScoreboardPresentation';
import { isYourNineEnabled } from '../dailyNineYourNineLayout';
import { useComp¶»§q«^