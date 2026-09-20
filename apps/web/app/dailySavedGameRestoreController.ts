import type { LoadedSavedDailyGame, SavedDailyGame } from './dailyLocalStorage';
import type { DailyHintBundle, DailyHintBundleResponse } from './dailyRuntimeContracts';

type DailySavedGameRestoreInput = {
  loaded: LoadedSavedDailyGame | null;
  totalAtBats: number;
  initialProgressionToken: string;
  initialHintBundle: DailyHintBundle;
  onApplyInitialState: () => void;
  onApplySavedGame: (savedGame: SavedDailyGame) => void;
  onLoaded: () => void;
  onHintBundleChange: (bundle: DailyHintBundle | null) => void;
  onPendingChange: (pending: boolean) => void;
  onErrorChange: (message: string | null) => void;
};

type LoadDailyHintBundle = (
  progressionToken: string,
) => Promise<DailyHintBundleResponse>;

export type DailySavedGameRestoreController = {
  restore(input: DailySavedGameRestoreInput): void;
  invalidate(): void;
};

export function createDailySavedGameRestoreController(
  loadHintBundle: LoadDailyHintBundle = fetchDailySavedGameHintBundle,
): DailySavedGameRestoreController {
  let generation = 0;

  return {
    restore,
    invalidate,
  };

  function restore(input: DailySavedGameRestoreInput): void {
    const restoreGeneration = ++generation;
    const savedGame = input.loaded?.savedGame ?? null;
    if (savedGame === null) {
      input.onApplyInitialState();
      input.onLoaded();
      return;
    }

    input.onApplySavedGame(savedGame);
    input.onLoaded();

    if (isSavedGameComplete(savedGame, input.totalAtBats)) {
      input.onHintBundleChange(null);
      input.onPendingChange(false);
      return;
    }

    if (canReuseInitialHintBundle(savedGame, input.initialProgressionToken)) {
      input.onHintBundleChange(input.initialHintBundle);
      input.onPendingChange(false);
      return;
    }

    input.onHintBundleChange(null);
    input.onPendingChange(true);
    void loadHintBundle(savedGame.progressionToken)
      .then((response) => {
        if (generation !== restoreGeneration) return;
        input.onHintBundleChange(response.hintBundle);
        input.onErrorChange(null);
      })
      .catch(() => {
        if (generation !== restoreGeneration) return;
        input.onErrorChange('The saved at-bat could not be restored. Reset today’s game to continue.');
      })
      .finally(() => {
        if (generation === restoreGeneration) input.onPendingChange(false);
      });
  }

  function invalidate(): void {
    generation += 1;
  }
}

function isSavedGameComplete(savedGame: SavedDailyGame, totalAtBats: number): boolean {
  return savedGame.gameState.points.completed
    || savedGame.gameState.score.completed
    || savedGame.currentPitchIndex >= totalAtBats
    || savedGame.pendingAdvance?.points.completed === true
    || savedGame.pendingAdvance?.score.completed === true
    || (savedGame.pendingAdvance?.nextPitchIndex ?? 0) >= totalAtBats;
}

function canReuseInitialHintBundle(
  savedGame: SavedDailyGame,
  initialProgressionToken: string,
): boolean {
  return savedGame.currentPitchIndex === 0
    && savedGame.progressionToken === initialProgressionToken;
}

async function fetchDailySavedGameHintBundle(
  progressionToken: string,
): Promise<DailyHintBundleResponse> {
  const response = await fetch('/api/daily/hints', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ progressionToken }),
  });
  const payload = await response.json() as DailyHintBundleResponse & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Hint restoration failed with ${response.status}.`);
  }
  return payload;
}
