import { applyDailyOutcomeToInning } from '@initial-baseball/engine';
import type { DailyGameState, DailyGuessResult, DailyRevealCount, DailySharePitchLine } from '@initial-baseball/shared';

type TerminalDailyGuessResult = Extract<DailyGuessResult, { kind: 'correct' | 'strikeout' }>;

type DailyAtBatResolutionPitch = {
  player: {
    initials: string;
  };
};

export type PendingAtBatAdvance = {
  inning: DailyGameState['inning'];
  score: DailyGameState['score'];
  pitchLines: DailySharePitchLine[];
  nextPitchIndex: number;
};

type ResolveDailyTerminalAtBatInput = {
  gameState: DailyGameState;
  pitch: DailyAtBatResolutionPitch;
  result: TerminalDailyGuessResult;
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
  currentPitchIndex,
}: ResolveDailyTerminalAtBatInput): PendingAtBatAdvance {
  const outcome: DailySharePitchLine['outcome'] = result.kind === 'correct' ? result.outcome : 'K';
  const nextEngineState = applyDailyOutcomeToInning({
    inning: gameState.inning,
    score: gameState.score,
    outcome,
  });

  return {
    inning: nextEngineState.inning,
    score: nextEngineState.score,
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
