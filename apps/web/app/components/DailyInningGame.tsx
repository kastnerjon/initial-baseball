'use client';

import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import {
  createDailyShareResult,
  evaluateGuess,
  formatDailyShareText,
  getGuessOutcome,
} from '@initial-baseball/engine';
import type { DailyGameState, DailyGuessResult, DailyPuzzle, Player } from '@initial-baseball/shared';
import {
  type PendingAtBatAdvance,
  createGiveUpResult,
  resolveDailyTerminalAtBat,
} from '../dailyAtBatResolution';
import {
  type DemoAtBatUiState,
  type DemoDailyPitch,
  createInitialAtBatUiState,
  createInitialDemoGameState,
} from '../mockDailyPuzzle';
import { AtBatCard } from './AtBatCard';
import { DailyScorebug } from './DailyScorebug';
import { GameCompleteView } from './GameCompleteView';
import { PitchResultList } from './PitchResultList';

type DailyInningGameProps = {
  puzzle: DailyPuzzle;
  demoPitches: DemoDailyPitch[];
  players: Player[];
};

export function DailyInningGame({ puzzle, demoPitches, players }: DailyInningGameProps): JSX.Element {
  const [gameState, setGameState] = useState<DailyGameState>(() => createInitialDemoGameState(puzzle));
  const [currentPitchIndex, setCurrentPitchIndex] = useState(0);
  const [atBatState, setAtBatState] = useState<DemoAtBatUiState>(() => createInitialAtBatUiState());
  const [pendingAdvance, setPendingAdvance] = useState<PendingAtBatAdvance | null>(null);

  const currentDemoPitch = demoPitches[currentPitchIndex] ?? null;
  const isPuzzleComplete = currentPitchIndex >= demoPitches.length;
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
          url: `https://initialbaseball.com/daily/${puzzle.puzzleNumber}`,
        })
      : null),
    [gameState, isGameComplete, puzzle.puzzleNumber],
  );

  if (shareResult !== null) {
    return (
      <GameCompleteView
        shareResult={shareResult}
        shareText={formatDailyShareText(shareResult)}
      />
    );
  }

  if (currentDemoPitch === null) {
    return <div className="game-shell" />;
  }

  return (
    <div className="game-shell">
      <DailyScorebug
        puzzleNumber={puzzle.puzzleNumber}
        summary={gameState.score}
        bases={gameState.inning.bases}
        currentStrikeCount={atBatState.strikeCount}
      />
      <PitchResultList pitchLines={gameState.completedPitchLines} title="Completed Pitches" emptyLabel="No completed pitches yet." />
      <AtBatCard
        atBat={currentDemoPitch}
        players={players}
        state={atBatState}
        onQueryChange={(query) => {
          setAtBatState((currentState) => ({
            ...currentState,
            query,
            selectedPlayerId: null,
            submittedResult: null,
          }));
        }}
        onSelectPlayer={(playerId, displayName) => {
          setAtBatState((currentState) => ({
            ...currentState,
            query: displayName,
            selectedPlayerId: playerId,
            submittedResult: null,
          }));
        }}
        onRevealHint={() => {
          setAtBatState((currentState) => ({
            ...currentState,
            revealCount: capRevealCount(currentState.revealCount + 1, currentDemoPitch.hints.length),
            submittedResult: null,
          }));
        }}
        onSubmit={() => handleSubmit(currentDemoPitch)}
        onGiveUp={() => handleGiveUp(currentDemoPitch)}
        onNextPitch={handleNextPitch}
      />
    </div>
  );

  function handleSubmit(pitch: DemoDailyPitch): void {
    if (atBatState.selectedPlayerId === null) {
      return;
    }

    const result = getGuessOutcome({
      isCorrect: evaluateGuess(atBatState.selectedPlayerId, pitch.correctPlayerId),
      revealCount: atBatState.revealCount,
      strikeCount: atBatState.strikeCount,
      maxStrikes: 3,
    });

    if (result.kind === 'incorrect') {
      setAtBatState((currentState) => ({
        ...currentState,
        query: '',
        selectedPlayerId: null,
        strikeCount: result.strikeCount,
        submittedResult: result,
      }));
      return;
    }

    if (result.kind === 'correct') {
      resolveTerminalResult(pitch, result);
    } else if (result.kind === 'strikeout') {
      resolveTerminalResult(pitch, result);
    }
  }

  function handleGiveUp(pitch: DemoDailyPitch): void {
    resolveTerminalResult(pitch, createGiveUpResult(atBatState.revealCount, 3));
  }

  function resolveTerminalResult(
    pitch: DemoDailyPitch,
    result: Extract<DailyGuessResult, { kind: 'correct' | 'strikeout' }>,
  ): void {
    setPendingAdvance(resolveDailyTerminalAtBat({
      gameState,
      pitch,
      result,
      currentPitchIndex,
    }));
    setAtBatState((currentState) => ({
      ...currentState,
      strikeCount: result.kind === 'strikeout' ? result.strikeCount : currentState.strikeCount,
      submittedResult: result,
    }));
  }

  function handleNextPitch(): void {
    if (pendingAdvance === null) {
      return;
    }

    setGameState((currentGameState) => ({
      ...currentGameState,
      status: pendingAdvance.score.completed || pendingAdvance.nextPitchIndex >= demoPitches.length ? 'completed' : 'in_progress',
      inning: pendingAdvance.inning,
      score: pendingAdvance.score,
      completedPitchLines: pendingAdvance.pitchLines,
      shareResult: null,
    }));
    setCurrentPitchIndex(pendingAdvance.nextPitchIndex);
    setPendingAdvance(null);
    setAtBatState(createInitialAtBatUiState());
  }
}

function capRevealCount(value: number, maxHints: number): DemoAtBatUiState['revealCount'] {
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
