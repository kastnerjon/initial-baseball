'use client';

import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createDailyShareResult, formatDailyShareText, type PlayerSearchResult } from '@initial-baseball/engine';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  isDailyPointsRulesetVersion,
  type DailyAtBatResolution,
  type DailyGameState,
  type DailyGuessResult,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import { type PendingAtBatAdvance, resolveDailyTerminalAtBat } from '../dailyAtBatResolution';
import { revealNextHintFromBundle } from '../dailyHintBundle';
import type { LoadedSavedDailyGame, SavedDailyGame } from '../dailyLocalStorage';
import { createDailySavedGameRestoreController } from '../dailySavedGameRestoreController';
import { useDailyGameplayPersistence } from '../useDailyGameplayPersistence';
import { createDailyShareUrl } from '../dailyShareUrl';
import type { CanonicalRevealViewModel } from '../canonicalRevealViewModel';
import { type DailyAtBatUiState, createInitialAtBatUiState, createInitialDailyGameState } from '../dailyClientState';
import type {
  DailyBootstrapRulesetVersion,
  DailyHintBundle,
} from '../dailyRuntimeContracts';
import { createDailyScorecardPoints, type DailyScorecardAnswers } from '../dailyScorecard';
import { createDailyNineInningScoreboardPresentation } from '../dailyNineInningScoreboardPresentation';
import { useCompletedDailyResultSubmission } from '../useCompletedDailyResultSubmission';
import { useDailyGameplayResolutionRequests } from '../useDailyGameplayResolutionRequests';
import {
  createDailyNineAtBatComparisonInput,
  createDailyNineAtBatComparisonState,
} from '../dailyNineAtBatComparisonState';
import { createDailyNineCompletedComparisonInput, useDailyNineCompletedComparison } from '../useDailyNineCompletedComparison';
import { useDailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';
import { AtBatCard } from './AtBatCard';
import { DailyScorebug } from './DailyScorebug';
import { GameCompleteView } from './GameCompleteView';
import { InningScoreboard } from './InningScoreboard';
import { PitchResultList } from './PitchResultList';
import { isArchiveDailyPuzzleId } from '../dailyModeStorage';

type DailyInningGameProps = {
  puzzle: DailyPublicPuzzle;
  rulesetVersion: DailyBootstrapRulesetVersion;
  initialProgressionToken: string;
  initialHintBundle: DailyHintBundle;
  archivePath?: string;
};

export function DailyInningGame({
  puzzle,
  rulesetVersion,
  initialProgressionToken,
  initialHintBundle,
  archivePath,
}: DailyInningGameProps): JSX.Element {
  const archive = isArchiveDailyPuzzleId(puzzle.id);
  const [gameState, setGameState] = useState<DailyGameState>(() => createInitialDailyGameState(puzzle, rulesetVersion));
  const [scorecardAnswers, setScorecardAnswers] = useState<DailyScorecardAnswers>({});
  const [currentPitchIndex, setCurrentPitchIndex] = useState(0);
  const [atBatState, setAtBatState] = useState<DailyAtBatUiState>(() => createInitialAtBatUiState());
  const [pendingAdvance, setPendingAdvance] = useState<PendingAtBatAdvance | null>(null);
  const [progressionToken, setProgressionToken] = useState(initialProgressionToken);
  const [hintBundle, setHintBundle] = useState<DailyHintBundle | null>(initialHintBundle);
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [bundlePending, setBundlePending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const resolutionRequests = useDailyGameplayResolutionRequests(setRequestError);
  const [savedGameRestoreController] = useState(createDailySavedGameRestoreController);
  const currentPitch = puzzle.pitches[currentPitchIndex] ?? null;
  const displayedCompletedAtBats = pendingAdvance?.completedAtBats ?? gameState.completedAtBats;
  const scorecardPoints = useMemo(
    () => createDailyScorecardPoints(displayedCompletedAtBats, gameState.rulesetVersion),
    [displayedCompletedAtBats, gameState.rulesetVersion],
  );
  const completedResultSubmission = useCompletedDailyResultSubmission(hasLoadedSavedState, gameState);
  const gameplayPersistence = useDailyGameplayPersistence({
    puzzle,
    rulesetVersion,
    initialProgressionToken,
    hasLoadedSavedState,
    saveInput: {
      currentPitchIndex,
      gameState,
      atBatState,
      pendingAdvance,
      progressionToken,
      scorecardAnswers,
    },
    onRestore: restoreLoadedGame,
    onPersistenceSessionInvalidated: resolutionRequests.invalidate,
    submitCompletedResultCreationIfEligible: completedResultSubmission.submitCreationIfEligible,
  });
  const comparisonExcludedResultId = gameplayPersistence.comparisonExcludedResultId;
  const completedComparison = useDailyNineCompletedComparison(!hasLoadedSavedState ? null : createDailyNineCompletedComparisonInput({
    puzzle,
    rulesetVersion: gameState.rulesetVersion,
    points: gameState.points,
    terminalPoints: pendingAdvance?.points ?? null,
    excludedResultId: comparisonExcludedResultId,
  }));
  const requestedPitchNumbers = useMemo(
    () => puzzle.pitches.map(pitch => pitch.pitchNumber),
    [puzzle.pitches],
  );
  const completedPitchNumbers = useMemo(
    () => puzzle.pitches
      .slice(0, gameState.completedPitchLines.length)
      .map(pitch => pitch.pitchNumber),
    [gameState.completedPitchLines.length, puzzle.pitches],
  );
  const scorecardComparisons = useDailyNineScorecardComparisons({
    enabled: hasLoadedSavedState,
    puzzle,
    rulesetVersion: gameState.rulesetVersion,
    requestedPitchNumbers,
    completedPitchNumbers,
    excludedResultId: comparisonExcludedResultId,
  });
  const atBatComparisonInput = hasLoadedSavedState
    ? createDailyNineAtBatComparisonInput({
        puzzle, rulesetVersion: gameState.rulesetVersion, pitch: currentPitch, result: atBatState.submittedResult,
        currentPoints: gameState.points.points, terminalPoints: pendingAdvance?.points.points ?? null,
      })
    : null;
  const atBatComparisonState = createDailyNineAtBatComparisonState(
    atBatComparisonInput === null
      ? undefined
      : scorecardComparisons.comparisons[atBatComparisonInput.key.pitchNumber],
    atBatComparisonInput?.ownPoints ?? null,
  );

  useEffect(() => () => {
    savedGameRestoreController.invalidate();
  }, [savedGameRestoreController]);

  const isPuzzleComplete = currentPitchIndex >= puzzle.pitches.length;
  const isGameComplete = gameState.points.completed || gameState.score.completed || isPuzzleComplete;
  const requestPending = resolutionRequests.pendingAction !== null;
  const isRestoringActiveHints = hasLoadedSavedState && hintBundle === null
    && pendingAdvance === null && !isGameComplete;

  const shareResult = useMemo(
    () => (isGameComplete
      ? createDailyShareResult({
          gameState: {
            ...gameState,
            status: 'completed',
            score: { ...gameState.score, completed: true },
            points: { ...gameState.points, completed: true },
          },
          url: archivePath ? `${createDailyShareUrl().replace(/\/$/, '')}${archivePath}` : createDailyShareUrl(
            gameState.rulesetVersion === CLASSIC_DAILY_RULESET_VERSION ? '/classic' : '/',
          ),
        })
      : null),
    [gameState, isGameComplete, archivePath],
  );

  if (gameplayPersistence.access === 'checking'
    || gameplayPersistence.access === 'follower'
    || gameplayPersistence.access === 'blocked') {
    return (
      <div className="game-shell">
        <section className="at-bat-card" aria-live="polite">
          <p>
            {gameplayPersistence.access === 'checking'
              ? 'Opening today’s game…'
              : gameplayPersistence.access === 'follower'
                ? 'This Daily is active in another tab. Close that tab to continue here.'
                : 'This Daily could not be restored safely in this tab. Refresh to try again.'}
          </p>
        </section>
      </div>
    );
  }

  if (shareResult !== null) {
    const completedInningScoreboard = isDailyPointsRulesetVersion(gameState.rulesetVersion)
      ? createDailyNineInningScoreboardPresentation({
          pitches: puzzle.pitches,
          currentPitchNumber: null,
          rulesetVersion: gameState.rulesetVersion,
          atBatPoints: scorecardPoints,
          atBatComparisons: scorecardComparisons.comparisons,
          totalPoints: gameState.points.points,
          completedComparison: completedComparison.state,
        })
      : undefined;
    return (
      <GameCompleteView
        scorecardAnswers={scorecardAnswers}
        shareResult={shareResult}
        shareText={`${archive ? 'Archive beta\n' : ''}${formatDailyShareText(shareResult)}`}
        comparison={completedComparison.state}
        atBatPoints={scorecardPoints}
        atBatComparisons={scorecardComparisons.comparisons}
        {...(completedInningScoreboard !== undefined ? { inningScoreboard: completedInningScoreboard } : {})}
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
  const displayedPoints = pendingAdvance?.points ?? gameState.points;
  const inningScoreboard = isDailyPointsRulesetVersion(gameState.rulesetVersion)
    ? createDailyNineInningScoreboardPresentation({
        pitches: puzzle.pitches,
        currentPitchNumber: activePitch.pitchNumber,
        rulesetVersion: gameState.rulesetVersion,
        atBatPoints: scorecardPoints,
        atBatComparisons: scorecardComparisons.comparisons,
        totalPoints: displayedPoints.points,
        completedComparison: completedComparison.state,
      })
    : null;
  const terminalPending = pendingAdvance?.points.completed === true || pendingAdvance?.score.completed === true;
  const terminalAwardedPoints = pendingAdvance === null
    ? null
    : pendingAdvance.points.points - gameState.points.points;

  return (
    <div className="game-shell">
      {inningScoreboard === null ? (
        <DailyScorebug
          currentAtBat={activePitch.pitchNumber}
          totalAtBats={puzzle.pitches.length}
          rulesetVersion={gameState.rulesetVersion}
          summary={pendingAdvance?.score ?? gameState.score}
          points={displayedPoints}
          bases={pendingAdvance?.inning.bases ?? gameState.inning.bases}
        />
      ) : (
        <InningScoreboard {...inningScoreboard} />
      )}
      <AtBatCard
        atBat={activePitch}
        rulesetVersion={gameState.rulesetVersion}
        state={atBatState}
        requestPending={requestPending}
        giveUpPending={resolutionRequests.pendingAction === 'give_up'}
        requestError={requestError}
        comparison={atBatComparisonState}
        terminalAwardedPoints={terminalAwardedPoints}
        nextActionLabel={terminalPending ? 'View Results' : 'Next At Bat'}
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
      {gameState.completedPitchLines.length > 0 ? (
        <PitchResultList
          answers={scorecardAnswers}
          {...(isDailyPointsRulesetVersion(gameState.rulesetVersion) ? { points: scorecardPoints } : {})}
          comparisons={scorecardComparisons.comparisons}
          pitchLines={gameState.completedPitchLines}
          title="Completed At-bats"
          emptyLabel="No completed at-bats yet."
          compact
        />
      ) : null}
      <button type="button" className="reset-local-result-button" onClick={handleResetToday}>
        Reset today's local result
      </button>
    </div>
  );

  async function handleSubmit(): Promise<void> {
    if (atBatState.selectedPlayerId === null) {
      return;
    }
    await resolutionRequests.resolveAtBat({
      progressionToken,
      action: { submittedPlayerId: atBatState.selectedPlayerId },
      onSuccess: (response) => {
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
      },
    });
  }

  async function handleGiveUp(): Promise<void> {
    await resolutionRequests.resolveAtBat({
      progressionToken,
      action: { giveUp: true },
      onSuccess: (response) => {
        if (response.result.kind === 'incorrect') return;
        setProgressionToken(response.progressionToken);
        setHintBundle(response.hintBundle);
        resolveTerminalResult(response.result, requireReveal(response.reveal), 'give_up');
      },
    });
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
    setScorecardAnswers(answers => ({ ...answers, [activePitch.pitchNumber]: reveal.displayName }));
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
      status: pendingAdvance.points.completed || pendingAdvance.score.completed || pendingAdvance.nextPitchIndex >= puzzle.pitches.length
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
    if (!gameplayPersistence.resetPersistedState()) return;
    completedComparison.invalidate();
    scorecardComparisons.invalidate();
    resolutionRequests.invalidate();
    savedGameRestoreController.invalidate();
    resetToInitialState();
    setBundlePending(false);
    setHasLoadedSavedState(true);
  }

  function resetToInitialState(): void {
    setGameState(createInitialDailyGameState(puzzle, rulesetVersion));
    setScorecardAnswers({});
    setCurrentPitchIndex(0);
    setAtBatState(createInitialAtBatUiState());
    setPendingAdvance(null);
    setProgressionToken(initialProgressionToken);
    setHintBundle(initialHintBundle);
    setRequestError(null);
  }

  function restoreLoadedGame(loaded: LoadedSavedDailyGame | null): void {
    completedComparison.invalidate();
    scorecardComparisons.invalidate();
    resolutionRequests.invalidate();
    savedGameRestoreController.restore({
      loaded,
      totalAtBats: puzzle.pitches.length,
      initialProgressionToken,
      initialHintBundle,
      onApplyInitialState: resetToInitialState,
      onApplySavedGame: applySavedGame,
      onLoaded: () => setHasLoadedSavedState(true),
      onHintBundleChange: setHintBundle,
      onPendingChange: setBundlePending,
      onErrorChange: setRequestError,
    });
  }

  function applySavedGame(savedGame: SavedDailyGame): void {
    setGameState(savedGame.gameState);
    setScorecardAnswers(savedGame.scorecardAnswers ?? {});
    setCurrentPitchIndex(savedGame.currentPitchIndex);
    setAtBatState(savedGame.atBatState);
    setPendingAdvance(savedGame.pendingAdvance);
    setProgressionToken(savedGame.progressionToken);
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
