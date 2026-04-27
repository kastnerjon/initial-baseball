import type {
  DailyGameState,
  DailySharePitchLine,
  DailyShareResult,
} from '@initial-baseball/shared';

export type CreateDailyShareResultInput = {
  gameState: DailyGameState;
  url: string;
};

export function createDailyShareResult(input: CreateDailyShareResultInput): DailyShareResult {
  return {
    puzzleNumber: input.gameState.puzzle.puzzleNumber,
    summary: input.gameState.score,
    pitchLines: input.gameState.completedPitchLines.map(toSharePitchLine),
    url: input.url,
  };
}

function toSharePitchLine(line: DailySharePitchLine): DailySharePitchLine {
  return {
    initials: line.initials,
    outcome: line.outcome,
  };
}
