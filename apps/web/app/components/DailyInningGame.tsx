'use client';

import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import {
  applyDailyOutcomeToInning,
  createDailyShareResult,
  evaluateGuess,
  formatDailyShareText,
  getGuessOutcome,
} from '@initial-baseball/engine';
import type { DailyGameState, DailyPuzzle, DailySharePitchLine, Player } from '@initial-baseball/shared';
import {
  type DemoAtBatUiState,
  type DemoDailyPitch,
  createInitialAtBatUiState,
  createInitialDemoGameState,
} from '../mockDailyPuzzle';
import { AtBatCard } from './AtBatCard';
import { GameCompleteView } from './GameCompleteView';
import { PitchResultList } from './PitchResultList';
import { ScoreLine } from './ScoreLine';

type DailyInningGameProps = {
  puzzle: DailyPuzzle;
  demoPitches: DemoDailyPitch[];
  players: Player[];
};

export function DailyInningGame({ puzzle, demoPitches, players }: DailyInningGameProps): JSX.Element {
  const [gameState, setGameState] = useState<DailyGameState>(() => createInitialDemoGameState(puzzle));
  const [currentPitchIndex, setCurrentPitchIndex] = useState(0);
  const [atBatState, setAtBatState] = useState<DemoAtBatUiState>(() => createInitialAtBatUiState());

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
      <ScoreLine summary={gameState.score} />
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
            revealCount: 1,
            submittedResult: null,
          }));
        }}
        onSubmit={() => handleSubmit(currentDemoPitch)}
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

    const outcome = result.kind === 'correct' ? result.outcome : 'K';
    const nextEngineState = applyDailyOutcomeToInning({
      inning: gameState.inning,
      score: gameState.score,
      outcome,
    });

    const nextPitchLines: DailySharePitchLine[] = [
      ...gameState.completedPitchLines,
      {
        initials: pitch.player.initials,
        outcome,
      },
    ];

    const nextPitchIndex = currentPitchIndex + 1;

    setGameState({
      ...gameState,
      status: nextEngineState.score.completed || nextPitchIndex >= puzzle.pitches.length ? 'completed' : 'in_progress',
      inning: nextEngineState.inning,
      score: nextEngineState.score,
      completedPitchLines: nextPitchLines,
      shareResult: null,
    });
    setCurrentPitchIndex(nextPitchIndex);
    setAtBatState(createInitialAtBatUiState());
  }
}
