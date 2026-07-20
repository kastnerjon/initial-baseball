import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
  type DailyPublicPuzzle,
  type HintType,
  type Player,
  type PlayerIdentity,
} from '@initial-baseball/shared';
import { baseballPlayers } from '@initial-baseball/baseball-data';
import { buildDefaultDailyHints } from './buildDefaultDailyHints';
import { createDailyPuzzlePitch, createPlayerIdentity } from './dailyPuzzleAdapters';
import {
  createInitialAtBatUiState,
  createInitialDailyGameState,
  createInitialDailyInningState,
  type DailyAtBatUiState,
} from './dailyClientState';

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

export type DemoAtBatUiState = DailyAtBatUiState;

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
  pitches: DEMO_DAILY_PITCHES.map((pitch) => createDailyPuzzlePitch(pitch.pitchNumber, requireDemoPlayer(pitch.player.fullName))),
};

export const createInitialDemoInningState = createInitialDailyInningState;

export function createInitialDemoGameState(puzzle: DailyPublicPuzzle | DailyPuzzle) {
  return createInitialDailyGameState(toPublicPuzzle(puzzle));
}

export { createInitialAtBatUiState };

function toPublicPuzzle(puzzle: DailyPublicPuzzle | DailyPuzzle): DailyPublicPuzzle {
  return {
    ...puzzle,
    pitches: puzzle.pitches.map((pitch) => (
      'initials' in pitch
        ? pitch
        : { pitchNumber: pitch.pitchNumber, initials: pitch.player.initials }
    )),
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
      ...createPlayerIdentity(player),
      initials,
    },
    hints: buildDefaultDailyHints(player),
    correctPlayerId: player.id,
  };
}

function requireDemoPlayer(name: string): Player {
  const player = baseballPlayers.find((candidate) => candidate.fullName === name || candidate.displayName === name || candidate.aliases.includes(name));

  if (player === undefined) {
    throw new Error(`Missing generated demo player: ${name}`);
  }

  return player;
}
