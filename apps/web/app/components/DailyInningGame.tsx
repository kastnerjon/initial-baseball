'use client';

import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  createDailyShareResult,
  formatDailyShareText,
  type PlayerSearchResult,
} from '@initial-baseball/engine';
import type {
  DailyAtBatResolution,
  DailyGameState,
  DailyGuessResult,
  DailyPublicPuzzle,
} from '@initial-baseball/shared';
import {
  type PendingAtBatAdvance,
  resolveDailyTerminalAtBat,
} from '../dailyAtBatResolution';
import { revealNextHintFromBundle } from '../dailyHintBundle';
import {
  clearSavedDailyGame,
  loadSavedDailyGame,
  saveDailyGame,
} from '../dailyLocalStorage';
import { createDailyShareUrl } from '../dailyShareUrl';
import type { CanonicalRevealViewModel } from '../canonicalRevealViewModel';
import {
  type DailyAtBatUiState,
  createInitialAtBatUiState,
  createInitialDailyGameState,
} from '../dailyClientState';
import type {
  DailyHintBundle,
  DailyHintBundleResponse,
  DailyResolutionResponse,
} from '../dailyRuntimeContracts';
import { AtBatCard } from './AtBatCard';
import { DailyScorebug } from './DailyScorebug';
import { GameCompleteView } from './GameCompleteView';
import { PitchResultList } from './PitchResultList';

type DailyInningGameProps = {
  puzzle: DailyPublicPuzzle;
  initialProgressionToken: string;
  initialHintBundle: DailyHintBundle;
};

export function DailyInningGame({
  puzzle,
  initialProgressionToken,
  initialHintBundle,
}: DailyInningGameProps): JSX.Element {
  const [gameState, setGameState] = useState<DailyGameState>(() => createInitialDailyGameState(puzzle));
  const [currentPitchIndex, setCurrentPitchIndex] = useState(0);
  const [atBatState, setAtBatState] = useState<DailyAtBatUiState>(() => createInitialAtBatUiState());
  const [pendingAdvance, setPendingAdvance] = useState<PendingAtBatAdvance | null>(null);
  const [progressionToken, setProgressionToken] = useState(initialProgressionToken);
  const [hintBundle, setHintBundle] = useState<DailyHintBundle | null>(initialHintBundle);
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [bundlePending, setBundlePending] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const currentPitch = puzzle.pitches[currentPitchIndex] ?? null;
  const isPuzzleComplete = currentPitchIndex >= puzzle.pitches.length;
  const isGameComplete = gameState.points.completed || gameState.score.completed || isPuzzleComplete;
  const isRestoringActiveHints = hasLoadedSavedState
    && hintBundle === null
    && pendingAdvance === null
    && !isGameComplete;

  const shareResult = useMemo(
    () => (isGameComplete
      ? createDailyShareResult({
          gameState: {
            ...gameState,
            status: 'completed',
            score: { ...gameState.score, completed: true },
            points: { ...gameState.points, completed: true },
          },
          url: createDailyShareUrl(),
        })
      : null),
    [gameState, isGameComplete],
  );

  useEffect(() => {
    let cancelled = false;
    const savedGame = loadSavedDailyGame(puzzle, initialProgressionToken);

    if (savedGame === null) {
      resetToInitialState();
      setHasLoadedSavedState(true);
      return () => {
        cancelled = true;
      };
    }

    setGameState(savedGame.gameState);
    setCurrentPitchIndex(savedGame.currentPitchIndex);
    setAtBatState(savedGame.atBatState);
    setPendingAdvance(savedGame.pendingAdvance);
    setProgressionToken(savedGame.progressionToken);
    setHasLoadedSavedState(true);

    const savedGameComplete = savedGame.gameState.points.completed
      || savedGame.gameState.score.completed
      || savedGame.currentPitchIndex >= puzzle.pitches.length;
    const canReuseInitialBundle = savedGame.currentPitchIndex === 0
      && savedGame.progressionToken === initialProgressionToken;

    if (savedGameComplete) {
      setHintBundle(null);
      setBundlePending(false);
      return () => {
        cancelled = true;
      };
    }

    if (canReuseInitialBundle) {
      setHintBundle(initialHintBundle);
      setBundlePending(false);
      return () => {
        cancelled = true;
      };
    }

    const savedProgressionToken = savedGame.progressionToken;
    setHintBundle(null);
    setBundlePending(true);
    void fetchHintBundle(savedProgressionToken)
      .then((response) => {
        if (!cancelled) {
          setProgressionToken(currentToken => {
            if (currentToken === savedProgressionToken) {
              setHintBundle(response.hintBundle);
              setRequestError(null);
            }
            return currentToken;
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRequestError('The saved at-bat could not be restored. Reset today’s game to continue.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBundlePending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialHintBundle, initialProgressionToken, puzzle]);

  useEffect(() => {
    if (!hasLoadedSavedState) {
      return;
    }

    saveDailyGame(puzzle, {
      currentPitchIndex,
      gameState,
      atBatState,
      pendingAdvance,
      progressionToken,
    });
  }, [atBatState, currentPitchIndex, gameState, hasLoadedSavedState, pendingAdvance, progressionToken, puzzle]);

  if (shareResult !== null) {
    return (
      <GameCompleteView
        shareResult={shareResult}
        shareText={formatDailyShareText(shareResult)}
        onResetToday={handleResetToday}
      />
    );
  }

  if (isRestoringActiveHints) {
    return (
      <div className="game-shell">
        <section className="at-bat-card" aria-live="polite">
          <p>{bundlePending ? 'Restoring today’s at-bat…' : requestError ?? 'The saved at-bat could not be restored.'}</p>
          {!bundlePending ? (
            <button type="button" className="button-secondary" onClick={handleResetToday}>
              Reset today’s game
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  if (currentPitch === null || (hintBundle === null && pendingAdvance === null)) {
    return <div className="game-shell" />;
  }
  const activePitch = currentPitch;

  return (
    <div className="game-shell">
      <DailyScorebug
        puzzleNumber={puzzle.puzzleNumber}
        rulesetVersion={gameState.rulesetVersion}
        summary={gameState.score}
        points={gameState.points}
        bases={gameState.inning.bases}
        currentStrikeCount={atBatState.strikeCount}
      />
      {gameState.completedPitchLines.length > 0 ? (
        <PitchResultList
          pitchLines={gameState.completedPitchLines}
          title="Completed At-bats"
          emptyLabel="No completed at-bats yet."
          compact
        />
      ) : null}
      <AtBatCard
        atBat={activePitch}
        state={atBatState}
        requestPending={requestPending}
        requestError={requestError}
        onQueryChange={(query) => {
          setAtBatState(currentState => ({
            ...currentState,
            query,
            selectedPlayerId: null,
            submittedResult: null,
          }));
          setRequestError(null);
        }}
        onSelectPlayer={(result: PlayerSearchResult) => {
          setAtBatState(currentState => ({
            ...currentState,
            query: result.displayName,
            selectedPlayerId: result.playerId,
            submittedResult: null,
          }));
        }}
        onRevealHint={handleRevealHint}
        onSubmit={() => { void handleSubmit(); }}
        onGiveUp={() => { void handleGiveUp(); }}
        onNextPitch={handleNextPitch}
      />
      <button type="button" className="reset-local-result-button" onClick={handleResetToday}>
        Reset today's local result
      </button>
    </div>
  );

  async function handleSubmit(): Promise<void> {
    if (atBatState.selectedPlayerId === null) {
      return;
    }
    const response = await resolveAtBat({ submittedPlayerId: atBatState.selectedPlayerId });
    if (response === null) return;
    setProgressionToken(response.progressionToken);
    const { result } = response;

    if (result.kind === 'incorrect') {
      setHintBundle(requireHintBundle(response.hintBundle));
      setAtBatState(currentState => ({
        ...currentState,
        query: '',
        selectedPlayerId: null,
        strikeCount: result.strikeCount,
        submittedResult: result,
      }));
      return;
    }

    setHintBundle(response.hintBundle);
    if (result.kind === 'correct') {
      resolveTerminalResult(result, requireReveal(response.reveal), 'correct');
    } else if (result.kind === 'strikeout') {
      resolveTerminalResult(result, requireReveal(response.reveal), 'strikeout');
    }
  }

  async function handleGiveUp(): Promise<void> {
    const response = await resolveAtBat({ giveUp: true });
    if (response === null || response.result.kind === 'incorrect') return;
    setProgressionToken(response.progressionToken);
    setHintBundle(response.hintBundle);
    resolveTerminalResult(response.result, requireReveal(response.reveal), 'give_up');
  }

  function resolveTerminalResult(
    result: Extract<DailyGuessResult, { kind: 'correct' | 'strikeout' }>,
    reveal: CanonicalRevealViewModel,
    resolution: DailyAtBatResolution,
  ): void {
    const wrongGuesses = resolution === 'give_up'
      ? atBatState.strikeCount
      : result.kind === 'strikeout'
        ? result.strikeCount
        : atBatState.strikeCount;
    setPendingAdvance(resolveDailyTerminalAtBat({
      gameState,
      pitch: {
        pitchNumber: activePitch.pitchNumber,
        player: { initials: activePitch.initials },
      },
      result,
      resolution,
      wrongGuesses,
      currentPitchIndex,
    }));
    setAtBatState(currentState => ({
      ...currentState,
      strikeCount: result.kind === 'strikeout' ? result.strikeCount : currentState.strikeCount,
      submittedResult: result,
      reveal,
    }));
  }

  function handleNextPitch(): void {
    if (pendingAdvance === null) {
      return;
    }

    setGameState(currentGameState => ({
      ...currentGameState,
      status: pendingAdvance.points.completed || pendingAdvance.nextPitchIndex >= puzzle.pitches.length
        ? 'completed'
        : 'in_progress',
      inning: pendingAdvance.inning,
      score: pendingAdvance.score,
      points: pendingAdvance.points,
      completedAtBats: pendingAdvance.completedAtBats,
      completedPitchLines: pendingAdvance.pitchLines,
      shareResult: null,
    }));
    setCurrentPitchIndex(pendingAdvance.nextPitchIndex);
    setPendingAdvance(null);
    setAtBatState(createInitialAtBatUiState());
    setRequestError(null);
  }

  function handleResetToday(): void {
    clearSavedDailyGame(puzzle);
    resetToInitialState();
    setRequestPending(false);
    setBundlePending(false);
    setHasLoadedSavedState(true);
  }

  function resetToInitialState(): void {
    setGameState(createInitialDailyGameState(puzzle));
    setCurrentPitchIndex(0);
    setAtBatState(createInitialAtBatUiState());
    setPendingAdvance(null);
    setProgressionToken(initialProgressionToken);
    setHintBundle(initialHintBundle);
    setRequestError(null);
  }

  function handleRevealHint(): void {
    try {
      const nextReveal = revealNextHintFromBundle(
        requireHintBundle(hintBundle),
        atBatState.revealCount,
      );
      setProgressionToken(nextReveal.progressionToken);
      setAtBatState(currentState => ({
        ...currentState,
        revealCount: nextReveal.revealedCount,
        revealedHints: [...currentState.revealedHints, nextReveal.hint],
        submittedResult: null,
      }));
      setRequestError(null);
    } catch {
      setRequestError('The next hint is unavailable. Reset today’s game if this continues.');
    }
  }

  async function resolveAtBat(
    action: { submittedPlayerId: string } | { giveUp: true },
  ): Promise<DailyResolutionResponse | null> {
    return requestJson<DailyResolutionResponse>('/api/daily/resolve', {
      progressionToken,
      ...action,
    });
  }

  async function requestJson<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
    if (requestPending) return null;
    setRequestPending(true);
    setRequestError(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as T & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Request failed with ${response.status}.`);
      }
      return payload;
    } catch {
      setRequestError('The Daily game could not complete that action. Please try again.');
      return null;
    } finally {
      setRequestPending(false);
    }
  }
}

async function fetchHintBundle(progressionToken: string): Promise<DailyHintBundleResponse> {
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

function requireHintBundle(bundle: DailyHintBundle | null): DailyHintBundle {
  if (bundle === null) {
    throw new Error('An active Daily result did not include an authorized hint bundle.');
  }
  return bundle;
}

function requireReveal(reveal: CanonicalRevealViewModel | null): CanonicalRevealViewModel {
  if (reveal === null) {
    throw new Error('A terminal Daily result did not include canonical reveal data.');
  }
  return reveal;
}
