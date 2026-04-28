import {
  DEFAULT_DAILY_BASE_STATE,
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_SCORE_SUMMARY,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyGameState,
  type DailyGuessResult,
  type DailyHintConfig,
  type DailyInningState,
  type DailyPuzzle,
  type HintType,
  type Player,
  type PlayerIdentity,
} from '@initial-baseball/shared';

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
  buildDemoPitch(1, 'KGJ', 'ken-griffey-jr', 'Ken Griffey Jr.', 'hitter', 'CF', [
    buildHint('main_decade', '1990s'),
    buildHint('teams', 'SEA, CIN, CHW'),
    buildHint('position', 'CF'),
    buildHint('stats', 'bWAR 83.8, HR 630'),
  ]),
  buildDemoPitch(2, 'DW', 'david-wright', 'David Wright', 'hitter', '3B', [
    buildHint('main_decade', '2000s'),
    buildHint('teams', 'NYM'),
    buildHint('position', '3B'),
    buildHint('stats', 'bWAR 49.2, HR 242'),
  ]),
  buildDemoPitch(3, 'CCS', 'cc-sabathia', 'CC Sabathia', 'pitcher', 'SP', [
    buildHint('main_decade', '2000s'),
    buildHint('teams', 'CLE, MIL, NYY'),
    buildHint('position', 'SP'),
    buildHint('stats', 'bWAR 61.8, ERA 3.74'),
  ]),
  buildDemoPitch(4, 'AJ', 'andruw-jones', 'Andruw Jones', 'hitter', 'CF', [
    buildHint('main_decade', '2000s'),
    buildHint('teams', 'ATL, LAD, TEX, CHW, NYY'),
    buildHint('position', 'CF'),
    buildHint('stats', 'bWAR 62.7, HR 434'),
  ]),
  buildDemoPitch(5, 'JV', 'jason-varitek', 'Jason Varitek', 'hitter', 'C', [
    buildHint('main_decade', '2000s'),
    buildHint('teams', 'BOS'),
    buildHint('position', 'C'),
    buildHint('stats', 'bWAR 24.1, HR 193'),
  ]),
  buildDemoPitch(6, 'HM', 'hideki-matsui', 'Hideki Matsui', 'hitter', 'LF', [
    buildHint('main_decade', '2000s'),
    buildHint('teams', 'NYY, LAA, OAK, TBR'),
    buildHint('position', 'LF'),
    buildHint('stats', 'bWAR 21.3, HR 175'),
  ]),
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
  playerId: string,
  fullName: string,
  kind: PlayerIdentity['kind'],
  primaryPosition: string,
  hints: DemoPitchHint[],
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
    hints,
    correctPlayerId: playerId,
  };
}

function buildHint(hintType: HintType, hintValue: string): DemoPitchHint {
  const hintConfig = getHintConfigForType(hintType);

  return {
    hintType,
    hintLabel: hintConfig.displayLabel,
    hintValue,
  };
}

function buildHintSet(hints: DemoPitchHint[]): DailyPuzzle['pitches'][number]['hints'] {
  return hints.reduce<DailyPuzzle['pitches'][number]['hints']>((hintSet, hint) => {
    hintSet[hint.hintType] = hint.hintValue;
    return hintSet;
  }, {});
}

function getHintConfigForType(hintType: HintType): DailyHintConfig[number] {
  const hintConfig = DEFAULT_DAILY_HINT_CONFIG.find((config) => config.hintType === hintType);

  if (hintConfig === undefined) {
    throw new Error(`Missing demo hint config for type: ${hintType}`);
  }

  return hintConfig;
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
