'use client';

import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createDailyShareResult,
  formatDailyShareText,
  getDailyAtBatPointsRemaining,
  type PlayerSearchResult,
} from '@initial-baseball/engine';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  type DailyAtBatResolution,
  type DailyGameState,
  type DailyGuessResult,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import {
  type PendingAtBatAdvance,
  resolveDailyTerminalAtBat,
} from '../dailyAtBatResolution';
import { revealNextHintFromBundle } from '../dailyHintBundle';
import type { LoadedSavedDailyGame } from '../dailyLocalStorage';
import { useDailyGameplayPersistence } from '../useDailyGameplayPersistence';
import { createDailyShareUrl } from '../dailyShareUrl';
import type { CanonicalRevealViewModel } from '../canonicalRevealViewModel';
import {
  type DailyAtBatUiState,
  createInitialAtBatUiState,
  createInitialDailyGameState,
} from '../dailyClientState';
import type {
  DailyBootstrapRulesetVersion,
  DailyHintBundle,
  DailyHintBundleResponse,
  DailyResolutionResponse,
} from '../dailyRuntimeContracts';
import type { DailyScorecardAnswers } from '../dailyScorecard';
import { useCompletedDailyResultSubmission } from '../useCompletedDailyResultSubmission';
import { createDailyGameplayRequestController, postDailyGameplayJson } from '../dailyGameplayRequestController';
import { createDailyNineAtBatComparisonInput, useDailyNineAtBatComparison } from '../useDailyNineAtBatComparison';
import { AtBatCard } from './AtBatCard';
import { DailyScorebug } from './DailyScorebug';
import { GameCompleteView } from './GameCompleteView';
import { PitchResultList } from './PitchResultList';

type DailyInningGameProps = {
  puzzle: DailyPublicPuzzle;
  rulesetVersion: DailyBootstrapRulesetVersion;
  initialProgressionToken: string;
  initialHintBundle: DailyHintBundle;
};

type PendingResolutionAction = 'guess' | 'give_up';

export function DailyInningGame({
  puzzle,
  rulesetVersion,
  initialProgressionToken,
  initialHintBundle,
}: DailyInningGameProps): JSX.Element {
  const [gameState, setGameState] = useState<DailyGameState>(() => createInitialDailyGameState(puzzle, rulesetVersion));
  const [scorecardAnswers, setScorecardAnswers] = useState<DailyScorecardAnswers>({});
  const [currentPitchIndex, setCurrentPitchIndex] = useState(0);
  const [atBatState, setAtBatState] = useState<DailyAtBatUiState>(() => createInitialAtBatUiState());
  const [pendingAdvance, setPendingAdvance] = useState<PendingAtBatAdvance | null>(null);
  const [progressionToken, setProgressionToken] = useState(initialProgressionToken);
  const [hintBundle, setHintBundle] = useState<DailyHintBundle | null>(initialHintBundle);
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [bundlePending, setBundlePending] = useState(false);
  const [pendingResolutionAction, setPendingResolutionAction] = useState<PendingResolutionAction | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const restoreGenerationRef = useRef(0);
  const [resolutionRequestController] = useState(createDailyGameplayRequestController);
  const currentPitch = puzzle.pitches[currentPitchIndex] ?? null;
  const atBatComparison = useDailyNineAtBatComparison(createDailyNineAtBatComparisonInput({
    puzzle, rulesetVersion: gameState.rulesetVersion, pitch: currentPitch, result: atBatState.submittedResult,
    currentPoints: gameState.points.points, terminalPoints: pendingAdvance?.points.points ?? null,
  }));
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
    onPersistenceSessionInvalidated: () => resolutionRequestController.invalidate(),
    submitCompletedResultCreationIfEligible: completedResultSubmission.submitCreationIfEligible,
  });

  useEffect(() => () => {
    restoreGenerationRef.current += 1;
    resolutionRequestController.invalidate();
  }, []);

  const isPuzzleComplete = currentPitchIndex >= puzzle.pitches.length;
  const isGameComplete = gameState.points.completed || gameState.score.completed || isPuzzleComplete;
  const requestPending = pendingResolutionAction !== null;
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
          url: createDailyShareUrl(
            gameState.rulesetVersion === CLASSIC_DAILY_RULESET_VERSION ? '/classic' : '/',
          ),
        })
      : null),
    [gameState, isGameComplete],
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
    return (
      <GameCompleteView
        scorecardAnswers={scorecardAnswers}
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
  const atBatPointsRemaining = getDailyAtBatPointsRemaining({
    rulesetVersion: gameState.rulesetVersion,
    hintsRevealed: atBatState.revealCount,
    wrongGuesses: atBatState.strikeCount,
    atBatComplete: atBatState.submittedResult !== null && atBatState.submittedResult.kind !== 'incorrect',
  });
  const terminalPending = pendingAdvance?.points.completed === true || pendingAdvance?.score.completed === true;

  return (
    <div className="game-shell">
      <DailyScorebug
        currentAtBat={activePitch.pitchNumber}
        totalAtBats={puzzle.pitches.length}
        rulesetVersion={gameState.rulesetVersion}
        summary={pendingAdvance?.score ?? gameState.score}
        points={pendingAdvance?.points ?? gameState.points}
        atBatPointsRemaining={atBatPointsRemaining}
        bases={pendingAdvance?.inning.bases ?? gameState.inning.bases}
      />
      <AtBatCard
        atBat={activePitch}
        rulesetVersion={gameState.rulesetVersion}
        state={atBatState}
        requestPending={requestPending}
        giveUpPending={pendingResolutionAction === 'give_up'}
        requestError={requestError}
        comparison={atBatComparison.state}
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
    await resolveAtBat(
      { submittedPlayerId: atBatState.selectedPlayerId },
      (response) => {
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
    );
  }

  async function handleGiveUp(): Promise<void> {
    await resolveAtBat(
      { giveUp: true },
      (response) => {
        if (response.result.kind === 'incorrect') return;
        setProgressionToken(response.progressionToken);
        setHintBundle(response.hintBundle);
        resolveTerminalResult(response.result, requireReveal(response.reveal), 'give_up');
      },
    );
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

    atBatComparison.invalidate();
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
    atBatComparison.invalidate();
    invalidateResolutionRequests();
    resetToInitialState();
    setBundlePending(false);
    setHasLoadedSavedState(true);
  }

  function resetToInitialState(): void {
    restoreGenerationRef.current += 1;
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
    atBatComparison.invalidate();
    invalidateResolutionRequests();
    const restoreGeneration = ++restoreGenerationRef.current;
    const savedGame = loaded?.savedGame ?? null;
    if (savedGame === null) {
      resetToInitialState();
      setHasLoadedSavedState(true);
      return;
    }

    const savedGameComplete = savedGame.gameState.points.completed
      || savedGame.gameState.score.completed
      || savedGame.currentPitchIndex >= puzzle.pitches.length
      || savedGame.pendingAdvance?.points.completed === true
      || savedGame.pendingAdvance?.score.completed === true
      || (savedGame.pendingAdvance?.nextPitchIndex ?? 0) >= puzzle.pitches.length;

    setGameState(savedGame.gameState);
    setScorecardAnswers(savedGame.scorecardAnswers ?? {});
    setCurrentPitchIndex(savedGame.currentPitchIndex);
    setAtBatState(savedGame.atBatState);
    setPendingAdvance(savedGame.pendingAdvance);
    setProgressionToken(savedGame.progressionToken);
    setHasLoadedSavedState(true);

    const canReuseInitialBundle = savedGame.currentPitchIndex === 0
      && savedGame.progressionToken === initialProgressionToken;
    if (savedGameComplete) {
      setHintBundle(null);
      setBundlePending(false);
      return;
    }
    if (canReuseInitialBundle) {
      setHintBundle(initialHintBundle);
      setBundlePending(false);
      return;
    }

    setHintBundle(null);
    setBundlePending(true);
    void fetchHintBundle(savedGame.progressionToken)
      .then((response) => {
        if (restoreGenerationRef.current !== restoreGeneration) return;
        setHintBundle(response.hintBundle);
        setRequestError(null);
      })
      .catch(() => {
        if (restoreGenerationRef.current !== restoreGeneration) return;
        setRequestError('The saved at-bat could not be restored. Reset today’s game to continue.');
      })
      .finally(() => {
        if (restoreGenerationRef.current === restoreGeneration) setBundlePending(false);
      });
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

  function resolveAtBat(
    action: { submittedPlayerId: string } | { giveUp: true },
    onSuccess: (response: DailyResolutionResponse) => void,
  ): Promise<void> {
    return requestJson<DailyResolutionResponse>(
      '/api/daily/resolve',
      { progressionToken, ...action },
      'giveUp' in action ? 'give_up' : 'guess',
      onSuccess,
    );
  }

  async function requestJson<T>(
    path: string,
    body: Record<string, unknown>,
    pendingAction: PendingResolutionAction,
    onSuccess: (payload: T) => void,
  ): Promise<void> {
    await resolutionRequestController.request({
      onStart: () => {
        setPendingResolutionAction(pendingAction);
        setRequestError(null);
      },
      execute: () => postDailyGameplayJson<T>(path, body),
      onSuccess,
      onError: () => {
        setRequestError('The Daily game could not complete that action. Please try again.');
      },
      onSettled: () => {
        setPendingResolutionAction(null);
      },
    });
  }

  function invalidateResolutionRequests(): void {
    resolutionRequestController.invalidate();
    setPendingResolutionAction(null);
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
