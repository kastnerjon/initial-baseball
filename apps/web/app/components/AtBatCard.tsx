'use client';

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import {
  type PlayerSearchResult,
} from '@initial-baseball/engine';
import { POINTS_V3_DAILY_RULESET_VERSION, POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import type {
  DailyGuessResult,
  DailyPublicPuzzlePitch,
  DailyRulesetVersion,
} from '@initial-baseball/shared';
import type { DailyAtBatUiState } from '../dailyClientState';
import type { DailyNineAtBatComparisonState } from '../dailyNineAtBatComparisonState';
import { DailyNineAtBatComparison } from './DailyNineAtBatComparison';
import { PlayerRevealCard } from './PlayerRevealCard';
import { ResultDisplay } from './ResultDisplay';
import { ResultsDropdown } from './ResultsDropdown';
import { SearchInput } from './SearchInput';

type AtBatCardProps = {
  atBat: DailyPublicPuzzlePitch;
  rulesetVersion: DailyRulesetVersion;
  state: DailyAtBatUiState;
  requestPending: boolean;
  giveUpPending: boolean;
  requestError: string | null;
  comparison: DailyNineAtBatComparisonState;
  terminalAwardedPoints: number | null;
  cumulativePoints: number;
  nextActionLabel?: string;
  onQueryChange: (query: string) => void;
  onSelectPlayer: (result: PlayerSearchResult) => void;
  onRevealHint: () => void;
  onSubmit: () => void;
  onGiveUp: () => void;
  onNextPitch: () => void;
};

export function AtBatCard({
  atBat,
  rulesetVersion,
  state,
  requestPending,
  giveUpPending,
  requestError,
  comparison,
  ¶»§q«^