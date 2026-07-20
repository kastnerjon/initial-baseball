'use client';

import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  createDailyShareResult,
  formatDailyShareText,
  type PlayerSearchResult,
} from '@initial-baseball/engine';
import type { DailyGameState, DailyGuessResult, DailyPublicPuzzle } from '@initial-baseball/shared';
import {
  type PendingAtBatAdvance,
  resolveDailyTerminalAtBat,
} from '../dailyAtBatResolution';
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
import type { DailyHintResponse, DailyResolutionResponse } from '../dailyRuntimeContracts';
import { AtBatCard } from './AtBatCard';
import { DailyScorebug } from './DailyScorebug';
import { GameCompleteView } from './GameCompleteView';
import { PitchResultList } from './PitchResultList';

type DailyInningGameProps = {
  puzzle: DailyPublicPuzzle;
  initialProgressionToken: string;
};

export function DailyInningGame({
  puzzle,
  initialProgressionToken,
}: DailyInningGameProps): JSX.Element {
  const [gameState, setGameState] = useState<DailyGameState>(() => createInitialDailyGameState(puzzle));
  const [currentPitchIndex, setCurrentPitchIndex] = useState(0);
  const [atBatState, setAtBatState] = useState<DailyAtBatUiState>(() => createInitialAtBatUiState());
  const [pendingAdvance, setPendingAdvance] = useState<PendingAtBatAdvance | null>(null);
  const [progressionToken, setProgressionToken] = useState(initialProgressionToken);
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const currentPitch = puzzle.pitches[currentPitchIndex] ?? null;
  const isPuzzleComplete = currentPitchIndex >= puzzle.pitches.length;
  const isGameComplete = gameState.score.completed || isPuzzleComplete;

  const shareResult = useMemo(
    () => (isGameComplete
      ? createDailyShareResult({
          gameState: {
            ...gameState,
            status: 'completed',
            score: {
              ...gameState.score,
              completed: true,
            },
          },
          url: createDailyShareUrl(),
        })
      : null),
    [gameState, isGameComplete],
  );

  useEffect(() => {
    const savedGame = loadSavedDailyGame(puzzle, initialProgressionToken);

    if (savedGame !== null) {
      setGameState(savedGame.gameState);
      setCurrentPitchIndex(savedGame.currentPitchIndex);
      setAtBatState(savedGame.atBatState);
      setPendingAdvance(savedGame.pendingAdvance);
      setProgressionToken(savedGame.progressionToken);
    } else {
      setGameState(createInitialDailyGameState(puzzle));
      setCurrentPitchIndex(0);
      setAtBatState(createInitialAtBatUiState());
      setPendingAdvance(null);
      setProgressionToken(initialProgressionToken);
    }

    setHasLoadedSavedState(true);
  }, [initialProgressionToken, puzzle]);

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

  if (currentPitch === null) {
    return <div className="game-shell" />;
  }
  const activePitch = currentPitch;

  return (
    <div className="game-shell">
      <DailyScorebug
        puzzleNumber={puzzle.puzzleNumber}
        summary={gameState.score}
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
        onRevealHint={() => { void handleRevealHint(); }}
        onSubmit={() => { void handleSubmit(); }}
        onGiveUp={() => { void handleGiveUp(); }}
        onNextPitch={handleNextPitch}
      />
      <button
        type="button"
        className="reset-local-result-button"
        onClick={handleResetToday}
      >
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
      setAtBatState(currentState => ({
        ...currentState,
        query: '',
        selectedPlayerId: null,
        strikeCount: result.strikeCount,
        submittedResult: result,
      }));
      return;
    }

    if (result.kind === 'correct') {
      resolveTerminalResult(result, requireReveal(response.reveal));
    } else if (result.kind === 'strikeout') {
      resolveTerminalResult(result, requireReveal(response.reveal));
    }
  }

  async function handleGiveUp(): Promise<void> {
    const response = await resolveAtBat({ giveUp: true });
    if (response === null || response.result.kind === 'incorrect') return;
    setProgressionToken(response.progressionToken);
    resolveTerminalResult(response.result, requireReveal(response.reveal));
  }

  function resolveTerminalResult(
    result: Extract<DailyGuessResult, { kind: 'correct' | 'strikeout' }>,
    reveal: CanonicalRevealViewModel,
  ): void {
    setPendingAdvance(resolveDailyTerminalAtBat({
      gameState,
      pitch: { player: { initials: activePitch.initials } },
      result,
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
      status: pendingAdvance.score.completed || pendingAdvance.nextPitchIndex >= puzzle.pitches.length ? 'completed' : 'in_progress',
      inning: pendingAdvance.inning,
      score: pendingAdvance.score,
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
    setGameState(createInitialDailyGameState(puzzle));
    setCurrentPitchIndex(0);
    setAtBatState(createInitialAtBatUiState());
    setPendingAdvance(null);
    setProgressionToken(initialProgressionToken);
    setRequestError(null);
    setRequestPending(false);
    setHasLoadedSavedState(true);
  }

  async function handleRevealHint(): Promise<void> {
    const response = await requestJson<DailyHintResponse>('/api/daily/hint', {
      progressionToken,
    });
    if (response === null) return;
    setProgressionToken(response.progressionToken);
    setAtBatState(currentState => ({
      ...currentState,
      revealCount: capRevealCount(currentState.revealCount + 1, puzzle.hintConfig.length),
      revealedHints: [...currentState.revealedHints, response.hint],
      submittedResult: null,
    }));
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

function requireReveal(reveal: CanonicalRevealViewModel | null): CanonicalRevealViewModel {
  if (reveal === null) {
    throw new Error('A terminal Daily result did not include canonical reveal data.');
  }
  return reveal;
}

function capRevealCount(value: number, maxHints: number): DailyAtBatUiState['revealCount'] {
  switch (Math.min(value, maxHints)) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    default:
      return 4;
  }
}
