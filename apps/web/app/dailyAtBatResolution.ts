import { applyDailyOutcomeForRuleset } from '@initial-baseball/engine';
import type {
  DailyAtBatResolution,
  DailyCompletedAtBat,
  DailyGameState,
  DailyGuessResult,
  DailyRevealCount,
  DailySharePitchLine,
} from '@initial-baseball/shared';

type TerminalDailyGuessResult = Extract<DailyGuessResult, { kind: 'correct' | 'strikeout' }>;

type DailyAtBatResolutionPitch = {
  pitchNumber: number;
  player: {
    initials: string;
  };
};

export type PendingAtBatAdvance = {
  inning: DailyGameState['inning'];
  score: DailyGameState['score'];
  points: DailyGameState['points'];
  completedAtBats: DailyCompletedAtBat[];
  pitchLines: DailySharePitchLine[];
  nextPitchIndex: number;
};

type ResolveDailyTerminalAtBatInput = {
  gameState: DailyGameState;
  pitch: DailyAtBatResolutionPitch;
  result: TerminalDailyGuessResult;
  resolution: DailyAtBatResolution;
  wrongGuesses: number;
  currentPitchIndex: number;
};

export function createGiveUpResult(revealCount: DailyRevealCount, maxStrikes: number): TerminalDailyGuessResult {
  return {
    kind: 'strikeout',
    revealedCount: revealCount,
    strikeCount: maxStrikes,
    outcome: 'K',
    source: 'strikeout',
  };
}

export function resolveDailyTerminalAtBat({
  gameState,
  pitch,
  result,
  resolution,
  wrongGuesses,
  currentPitchIndex,
}: ResolveDailyTerminalAtBatInput): PendingAtBatAdvance {
  const outcome: DailySharePitchLine['outcome'] = result.kind === 'correct' ? result.outcome : 'K';
  const nextEngineState = applyDailyOutcomeForRuleset({
    rulesetVersion: gameState.rulesetVersion,
    inning: gameState.inning,
    score: gameState.score,
    points: gameState.points,
    outcome,
    totalAtBats: gameState.puzzle.pitches.length,
  });
  const completedAtBat: DailyCompletedAtBat = {
    pitchNumber: pitch.pitchNumber,
    initials: pitch.player.initials,
    outcome,
    hintsRevealed: result.revealedCount,
    wrongGuesses: Math.max(0, wrongGuesses),
    resolution,
  };

  return {
    inning: nextEngineState.inning,
    score: nextEngineState.score,
    points: nextEngineState.points,
    completedAtBats: [...gameState.completedAtBats, completedAtBat],
    pitchLines: [
      ...gameState.completedPitchLines,
      {
        initials: pitch.player.initials,
        outcome,
      },
    ],
    nextPitchIndex: currentPitchIndex + 1,
  };
}
