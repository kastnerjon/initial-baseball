import { describe, expect, it, vi } from 'vitest';
import type { DailyHintBundle } from './dailyRuntimeContracts';
import type { LoadedSavedDailyGame, SavedDailyGame } from './dailyLocalStorage';
import { DAILY_STORAGE_SCHEMA_VERSION } from './dailySavedGameCodec';
import {
  DEMO_DAILY_PUZZLE,
  createInitialAtBatUiState,
  createInitialDemoGameState,
} from './mockDailyPuzzle';
import { createDailySavedGameRestoreController } from './dailySavedGameRestoreController';

const initialProgressionToken = 'initial-progression-token';
const restoredProgressionToken = 'restored-progression-token';
const initialHintBundle = buildHintBundle('initial');
const restoredHintBundle = buildHintBundle('restored');

describe('daily saved-game restore controller', () => {
  it('applies initial state without requesting hints when no compatible save exists', () => {
    const loadHintBundle = vi.fn();
    const controller = createDailySavedGameRestoreController(loadHintBundle);
    const callbacks = createCallbacks();

    controller.restore(buildRestoreInput(null, callbacks));

    expect(callbacks.onApplyInitialState).toHaveBeenCalledOnce();
    expect(callbacks.onApplySavedGame).not.toHaveBeenCalled();
    expect(callbacks.onLoaded).toHaveBeenCalledOnce();
    expect(loadHintBundle).not.toHaveBeenCalled();
  });

  it('applies a completed save without hydrating an active hint bundle', () => {
    const loadHintBundle = vi.fn();
    const controller = createDailySavedGameRestoreController(loadHintBundle);
    const callbacks = createCallbacks();
    const loaded = buildLoadedSavedGame({ completed: true });

    controller.restore(buildRestoreInput(loaded, callbacks));

    expect(callbacks.onApplySavedGame).toHaveBeenCalledWith(loaded.savedGame);
    expect(callbacks.onHintBundleChange).toHaveBeenCalledWith(null);
    expect(callbacks.onPendingChange).toHaveBeenCalledWith(false);
    expect(loadHintBundle).not.toHaveBeenCalled();
  });

  it('reuses the bootstrap hint bundle only for the untouched bootstrap token', () => {
    const loadHintBundle = vi.fn();
    const controller = createDailySavedGameRestoreController(loadHintBundle);
    const callbacks = createCallbacks();
    const loaded = buildLoadedSavedGame({
      currentPitchIndex: 0,
      progressionToken: initialProgressionToken,
    });

    controller.restore(buildRestoreInput(loaded, callbacks));

    expect(callbacks.onHintBundleChange).toHaveBeenCalledWith(initialHintBundle);
    expect(callbacks.onPendingChange).toHaveBeenCalledWith(false);
    expect(loadHintBundle).not.toHaveBeenCalled();
  });

  it('hydrates a non-bootstrap active save and clears the restore error on success', async () => {
    const pending = deferred<{ hintBundle: DailyHintBundle }>();
    const loadHintBundle = vi.fn(() => pending.promise);
    const controller = createDailySavedGameRestoreController(loadHintBundle);
    const callbacks = createCallbacks();
    const loaded = buildLoadedSavedGame({
      currentPitchIndex: 1,
      progressionToken: restoredProgressionToken,
    });

    controller.restore(buildRestoreInput(loaded, callbacks));

    expect(callbacks.onHintBundleChange).toHaveBeenCalledWith(null);
    expect(callbacks.onPendingChange).toHaveBeenLastCalledWith(true);
    expect(loadHintBundle).toHaveBeenCalledWith(restoredProgressionToken);

    pending.resolve({ hintBundle: restoredHintBundle });
    await flushAsyncWork();

    expect(callbacks.onHintBundleChange).toHaveBeenLastCalledWith(restoredHintBundle);
    expect(callbacks.onErrorChange).toHaveBeenCalledWith(null);
    expect(callbacks.onPendingChange).toHaveBeenLastCalledWith(false);
  });

  it('reports the current hint hydration failure and clears its pending state', async () => {
    const pending = deferred<{ hintBundle: DailyHintBundle }>();
    const controller = createDailySavedGameRestoreController(() => pending.promise);
    const callbacks = createCallbacks();

    controller.restore(buildRestoreInput(buildLoadedSavedGame({ currentPitchIndex: 1 }), callbacks));
    pending.reject(new Error('restore failed'));
    await flushAsyncWork();

    expect(callbacks.onErrorChange).toHaveBeenCalledWith(
      'The saved at-bat could not be restored. Reset today’s game to continue.',
    );
    expect(callbacks.onPendingChange).toHaveBeenLastCalledWith(false);
  });

  it('makes delayed hint success inert after explicit invalidation', async () => {
    const pending = deferred<{ hintBundle: DailyHintBundle }>();
    const controller = createDailySavedGameRestoreController(() => pending.promise);
    const callbacks = createCallbacks();

    controller.restore(buildRestoreInput(buildLoadedSavedGame({ currentPitchIndex: 1 }), callbacks));
    controller.invalidate();
    callbacks.onHintBundleChange.mockClear();
    callbacks.onErrorChange.mockClear();
    callbacks.onPendingChange.mockClear();

    pending.resolve({ hintBundle: restoredHintBundle });
    await flushAsyncWork();

    expect(callbacks.onHintBundleChange).not.toHaveBeenCalled();
    expect(callbacks.onErrorChange).not.toHaveBeenCalled();
    expect(callbacks.onPendingChange).not.toHaveBeenCalled();
  });

  it('prevents a stale failed restore from overwriting a newer restore', async () => {
    const stale = deferred<{ hintBundle: DailyHintBundle }>();
    const controller = createDailySavedGameRestoreController(() => stale.promise);
    let currentBundle: DailyHintBundle | null = initialHintBundle;
    let pending = false;
    let error: string | null = null;
    const callbacks = createCallbacks({
      onHintBundleChange: value => { currentBundle = value; },
      onPendingChange: value => { pending = value; },
      onErrorChange: value => { error = value; },
    });

    controller.restore(buildRestoreInput(buildLoadedSavedGame({ currentPitchIndex: 1 }), callbacks));
    expect(currentBundle).toBeNull();
    expect(pending).toBe(true);

    controller.restore(buildRestoreInput(buildLoadedSavedGame({
      currentPitchIndex: 0,
      progressionToken: initialProgressionToken,
    }), callbacks));
    expect(currentBundle).toBe(initialHintBundle);
    expect(pending).toBe(false);

    stale.reject(new Error('obsolete restore failure'));
    await flushAsyncWork();

    expect(currentBundle).toBe(initialHintBundle);
    expect(pending).toBe(false);
    expect(error).toBeNull();
  });
});

function buildRestoreInput(
  loaded: LoadedSavedDailyGame | null,
  callbacks: ReturnType<typeof createCallbacks>,
) {
  return {
    loaded,
    totalAtBats: DEMO_DAILY_PUZZLE.pitches.length,
    initialProgressionToken,
    initialHintBundle,
    ...callbacks,
  };
}

function buildLoadedSavedGame({
  completed = false,
  currentPitchIndex = 1,
  progressionToken = restoredProgressionToken,
}: {
  completed?: boolean;
  currentPitchIndex?: number;
  progressionToken?: string;
} = {}): LoadedSavedDailyGame {
  const initialGameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
  const savedGame: SavedDailyGame = {
    schemaVersion: DAILY_STORAGE_SCHEMA_VERSION,
    puzzleId: DEMO_DAILY_PUZZLE.id,
    puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
    puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
    currentPitchIndex,
    gameState: {
      ...initialGameState,
      status: completed ? 'completed' : 'in_progress',
      score: { ...initialGameState.score, completed },
      points: { ...initialGameState.points, completed },
    },
    atBatState: createInitialAtBatUiState(),
    pendingAdvance: null,
    progressionToken,
    scorecardAnswers: {},
  };
  return {
    savedGame,
    completedAtBatFactsAreNative: true,
  };
}

function buildHintBundle(prefix: string): DailyHintBundle {
  return {
    pitchNumber: 1,
    revealedCount: 0,
    hints: [
      { slot: 1, hintType: 'main_decade', hintLabel: 'Main decade played in', hintValue: `${prefix}-decade` },
      { slot: 2, hintType: 'teams', hintLabel: 'Teams', hintValue: `${prefix}-teams` },
      { slot: 3, hintType: 'position', hintLabel: 'Position', hintValue: `${prefix}-position` },
      { slot: 4, hintType: 'stats', hintLabel: 'Stats', hintValue: `${prefix}-stats` },
    ],
    checkpoints: [1, 2, 3, 4].map(revealedCount => ({
      revealedCount: revealedCount as 1 | 2 | 3 | 4,
      progressionToken: `${prefix}-token-${revealedCount}`,
    })),
  };
}

function createCallbacks(overrides: Partial<{
  onApplyInitialState: () => void;
  onApplySavedGame: (savedGame: SavedDailyGame) => void;
  onLoaded: () => void;
  onHintBundleChange: (bundle: DailyHintBundle | null) => void;
  onPendingChange: (pending: boolean) => void;
  onErrorChange: (message: string | null) => void;
}> = {}) {
  return {
    onApplyInitialState: vi.fn(overrides.onApplyInitialState ?? (() => undefined)),
    onApplySavedGame: vi.fn(overrides.onApplySavedGame ?? (() => undefined)),
    onLoaded: vi.fn(overrides.onLoaded ?? (() => undefined)),
    onHintBundleChange: vi.fn(overrides.onHintBundleChange ?? (() => undefined)),
    onPendingChange: vi.fn(overrides.onPendingChange ?? (() => undefined)),
    onErrorChange: vi.fn(overrides.onErrorChange ?? (() => undefined)),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
