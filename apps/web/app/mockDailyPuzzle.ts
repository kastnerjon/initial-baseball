import {
  DEFAULT_DAILY_BASE_STATE,
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_SCORE_SUMMARY,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyGameState,
  type DailyGuessResult,
  type DailyInningState,
  type DailyPuzzle,
  type HintType,
  type Player,
  type PlayerIdentity,
} from '@initial-baseball/shared';
import { baseballPlayers } from '@initial-baseball/baseball-data';
import { buildDefaultDailyHints } from './buildDefaultDailyHints';

export type DemoPitchHint = {
  hintType: HintType;
  hintLabel: string;
  hintValue: string;
};

export type DemoDailyPitch = {
  pitchNumber: number;
  player: PlayerIdentity;
  hints: DemoPitchHint[];
  correctPlayerId: string;
};

export type DemoAtBatUiState = {
  query: string;
  selectedPlayerId: string | null;
  revealCount: 0 | 1 | 2 | 3 | 4;
  strikeCount: number;
  submittedResult: DailyGuessResult | null;
};

export const DEMO_DAILY_PITCHES: DemoDailyPitch[] = [
  buildDemoPitch(1, 'KGJ', requireDemoPlayer('Ken Griffey Jr.')),
  buildDemoPitch(2, 'DW', requireDemoPlayer('David Wright')),
  buildDemoPitch(3, 'CCS', requireDemoPlayer('CC Sabathia')),
  buildDemoPitch(4, 'AJ', requireDemoPlayer('Andruw Jones')),
  buildDemoPitch(5, 'JV', requireDemoPlayer('Jason Varitek')),
  buildDemoPitch(6, 'HM', requireDemoPlayer('Hideki Matsui')),
];

export const DEMO_DAILY_PUZZLE: DailyPuzzle = {
  id: 'demo-daily-42',
  puzzleNumber: 42,
  puzzleDate: '2026-04-27',
  status: 'published',
  hintConfig: DEFAULT_DAILY_HINT_CONFIG,
  statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
  pitches: DEMO_DAILY_PITCHES.map((pitch) => ({
    pitchNumber: pitch.pitchNumber,
    player: pitch.player,
    hints: buildHintSet(pitch.hints),
  })),
};

export function createInitialDemoInningState(): DailyInningState {
  return {
    inningNumber: 1,
    outs: 0,
    maxOuts: 3,
    bases: { ...DEFAULT_DAILY_BASE_STATE },
    completedAtBats: [],
    currentAtBat: null,
  };
}

export function createInitialDemoGameState(puzzle: DailyPuzzle): DailyGameState {
  return {
    anonymousPlayerId: 'anon-demo',
    status: 'in_progress',
    puzzle,
    inning: createInitialDemoInningState(),
    score: { ...DEFAULT_DAILY_SCORE_SUMMARY },
    completedPitchLines: [],
    shareResult: null,
  };
}

export function createInitialAtBatUiState(): DemoAtBatUiState {
  return {
    query: '',
    selectedPlayerId: null,
    revealCount: 0,
    strikeCount: 0,
    submittedResult: null,
  };
}

function buildDemoPitch(
  pitchNumber: number,
  initials: string,
  player: Player,
): DemoDailyPitch {
  return {
    pitchNumber,
    player: {
      playerId: player.id,
      fullName: player.fullName,
      displayName: player.displayName,
      initials,
      kind: deriveDemoPlayerKind(player),
      primaryPosition: player.primaryPosition,
    },
    hints: buildDefaultDailyHints(player),
    correctPlayerId: player.id,
  };
}

function deriveDemoPlayerKind(player: Player): PlayerIdentity['kind'] {
  if (player.primaryRole === 'pitcher' || player.primaryRole === 'hitter') {
    return player.primaryRole;
  }

  return player.primaryPosition === 'P' ? 'pitcher' : 'hitter';
}

function buildHintSet(hints: DemoPitchHint[]): DailyPuzzle['pitches'][number]['hints'] {
  return hints.reduce<DailyPuzzle['pitches'][number]['hints']>((hintSet, hint) => {
    hintSet[hint.hintType] = hint.hintValue;
    return hintSet;
  }, {});
}

function requireDemoPlayer(name: string): Player {
  const player = baseballPlayers.find((candidate) => candidate.fullName === name || candidate.displayName === name || candidate.aliases.includes(name));

  if (player === undefined) {
    throw new Error(`Missing generated demo player: ${name}`);
  }

  return player;
}
