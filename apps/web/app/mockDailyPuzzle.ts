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

export type DemoDailyPitch = {
  pitchNumber: number;
  player: PlayerIdentity;
  hintType: Extract<HintType, 'main_decade' | 'teams'>;
  hintLabel: string;
  hintValue: string;
  correctPlayerId: string;
};

export type DemoAtBatUiState = {
  query: string;
  selectedPlayerId: string | null;
  revealCount: 0 | 1;
  strikeCount: number;
  submittedResult: DailyGuessResult | null;
};

export const DEMO_PLAYERS: Player[] = [
  buildPlayer('ken-griffey-jr', 'Ken Griffey Jr.', 'Ken Griffey Jr.', 'hitter', 'CF', '1990s', 'SEA, CIN, CHW', ['The Kid', 'Ken Griffey']),
  buildPlayer('ken-griffey-sr', 'Ken Griffey Sr.', 'Ken Griffey Sr.', 'hitter', 'OF', '1970s', 'CIN, NYY, ATL, SEA', []),
  buildPlayer('david-wright', 'David Wright', 'David Wright', 'hitter', '3B', '2000s', 'NYM', ['Captain America']),
  buildPlayer('david-ortiz', 'David Ortiz', 'David Ortiz', 'hitter', 'DH', '2000s', 'MIN, BOS', ['Big Papi']),
  buildPlayer('dave-winfield', 'Dave Winfield', 'Dave Winfield', 'hitter', 'RF', '1980s', 'SDP, NYY, CAL, TOR, MIN, CLE', []),
  buildPlayer('cc-sabathia', 'CC Sabathia', 'CC Sabathia', 'pitcher', 'SP', '2000s', 'CLE, MIL, NYY', ['Carsten Sabathia']),
  buildPlayer('andruw-jones', 'Andruw Jones', 'Andruw Jones', 'hitter', 'CF', '2000s', 'ATL, LAD, TEX, CHW, NYY', []),
  buildPlayer('jason-varitek', 'Jason Varitek', 'Jason Varitek', 'hitter', 'C', '2000s', 'BOS', ['Tek']),
  buildPlayer('hideki-matsui', 'Hideki Matsui', 'Hideki Matsui', 'hitter', 'LF', '2000s', 'NYY, LAA, OAK, TBR', ['Godzilla']),
];

export const DEMO_DAILY_PITCHES: DemoDailyPitch[] = [
  buildDemoPitch(1, 'KGJ', 'ken-griffey-jr', 'Ken Griffey Jr.', 'hitter', 'CF', 'main_decade', 'Main Decade', '1990s'),
  buildDemoPitch(2, 'DW', 'david-wright', 'David Wright', 'hitter', '3B', 'teams', 'Teams', 'NYM'),
  buildDemoPitch(3, 'CCS', 'cc-sabathia', 'CC Sabathia', 'pitcher', 'SP', 'main_decade', 'Main Decade', '2000s'),
  buildDemoPitch(4, 'AJ', 'andruw-jones', 'Andruw Jones', 'hitter', 'CF', 'teams', 'Teams', 'ATL, LAD, TEX, CHW, NYY'),
  buildDemoPitch(5, 'JV', 'jason-varitek', 'Jason Varitek', 'hitter', 'C', 'main_decade', 'Main Decade', '2000s'),
  buildDemoPitch(6, 'HM', 'hideki-matsui', 'Hideki Matsui', 'hitter', 'LF', 'teams', 'Teams', 'NYY, LAA, OAK, TBR'),
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
    hints: {
      [pitch.hintType]: pitch.hintValue,
    },
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
  playerId: string,
  fullName: string,
  kind: PlayerIdentity['kind'],
  primaryPosition: string,
  hintType: DemoDailyPitch['hintType'],
  hintLabel: string,
  hintValue: string,
): DemoDailyPitch {
  return {
    pitchNumber,
    player: {
      playerId,
      fullName,
      displayName: fullName,
      initials,
      kind,
      primaryPosition,
    },
    hintType,
    hintLabel,
    hintValue,
    correctPlayerId: playerId,
  };
}

function buildPlayer(
  id: string,
  fullName: string,
  displayName: string,
  primaryRole: Player['primaryRole'],
  primaryPosition: string,
  mainDecade: string,
  teamsDisplay: string,
  aliases: string[],
): Player {
  return {
    id,
    fullName,
    displayName,
    primaryRole,
    primaryPosition,
    mainDecade,
    teamsDisplay,
    aliases,
  };
}
