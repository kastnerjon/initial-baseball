import {
  applyDailyOutcomeToInning,
  createDailyShareResult,
  type DailyInningEngineState,
} from '@initial-baseball/engine';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_SCORE_SUMMARY,
  type DailyGameState,
  type DailyPuzzle,
  type DailySharePitchLine,
} from '@initial-baseball/shared';

const DAILY_PUZZLE: DailyPuzzle = {
  id: 'daily-42',
  puzzleNumber: 42,
  puzzleDate: '2026-04-27',
  status: 'published',
  hintConfig: DEFAULT_DAILY_HINT_CONFIG,
  statsHintConfig: {
    hitter: ['bwar', 'hr'],
    pitcher: ['bwar', 'era'],
  },
  pitches: [
    buildPitch(1, 'kgj', 'Ken Griffey Jr.', 'KGJ', 'hitter', 'CF'),
    buildPitch(2, 'dw', 'David Wright', 'DW', 'hitter', '3B'),
    buildPitch(3, 'hm', 'Hideki Matsui', 'HM', 'hitter', 'LF'),
    buildPitch(4, 'jv', 'Jason Varitek', 'JV', 'hitter', 'C'),
    buildPitch(5, 'ccs', 'CC Sabathia', 'CCS', 'pitcher', 'SP'),
    buildPitch(6, 'aj', 'Andruw Jones', 'AJ', 'hitter', 'CF'),
  ],
};

const MOCK_PITCH_LINES: DailySharePitchLine[] = [
  { initials: 'KGJ', outcome: 'HR' },
  { initials: 'DW', outcome: '2B' },
  { initials: 'HM', outcome: '1B' },
  { initials: 'JV', outcome: 'BUNT' },
  { initials: 'CCS', outcome: 'K' },
  { initials: 'AJ', outcome: 'HR' },
];

export function createMockDailyShareResult() {
  return createDailyShareResult({
    gameState: createMockDailyGameState(),
    url: 'https://initialbaseball.com/daily/42',
  });
}

function createMockDailyGameState(): DailyGameState {
  const engineState = MOCK_PITCH_LINES.reduce<DailyInningEngineState>(
    (currentState, line) =>
      applyDailyOutcomeToInning({
        inning: currentState.inning,
        score: currentState.score,
        outcome: line.outcome,
      }),
    {
      inning: {
        inningNumber: 1,
        outs: 0,
        maxOuts: 3,
        bases: { first: false, second: false, third: false },
        completedAtBats: [],
        currentAtBat: null,
      },
      score: DEFAULT_DAILY_SCORE_SUMMARY,
    },
  );

  return {
    anonymousPlayerId: 'anon-web-shell',
    status: engineState.score.completed ? 'completed' : 'in_progress',
    puzzle: DAILY_PUZZLE,
    inning: engineState.inning,
    score: engineState.score,
    completedPitchLines: MOCK_PITCH_LINES,
    shareResult: null,
  };
}

function buildPitch(
  pitchNumber: number,
  playerId: string,
  fullName: string,
  initials: string,
  kind: 'hitter' | 'pitcher',
  primaryPosition: string,
) {
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
    hints: {},
  };
}
