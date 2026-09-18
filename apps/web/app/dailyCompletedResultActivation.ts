import type { SavedDailyGame } from './dailyLocalStorage';

export function canCreateCompletedResultFromLoadedSave(input: {
  savedGame: SavedDailyGame;
  totalAtBats: number;
  completedAtBatFactsAreNative: boolean;
}): boolean {
  const { savedGame, totalAtBats, completedAtBatFactsAreNative } = input;
  const completed = savedGame.gameState.points.completed
    || savedGame.gameState.score.completed
    || savedGame.currentPitchIndex >= totalAtBats
    || savedGame.pendingAdvance?.points.completed === true
    || savedGame.pendingAdvance?.score.completed === true
    || (savedGame.pendingAdvance?.nextPitchIndex ?? 0) >= totalAtBats;

  if (completed) return false;

  const hasNoCompletedFacts = savedGame.gameState.completedAtBats.length === 0
    && (savedGame.pendingAdvance?.completedAtBats.length ?? 0) === 0;

  return completedAtBatFactsAreNative || hasNoCompletedFacts;
}
