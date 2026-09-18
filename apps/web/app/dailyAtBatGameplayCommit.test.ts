import { POINTS_V3_DAILY_RULESET_VERSION, type DailyCompletedAtBat } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DailyAtBatAttemptIdentity } from './dailyAtBatAttemptJournal';
import { persistGameplayThenFreezeDailyAtBats } from './dailyAtBatGameplayCommit';
import type { DailyAtBatContributionSession } from './dailyAtBatGameplayLifecycle';
import type { SaveDailyGameInput } from './dailyLocalStorage';
import {
  DEMO_DAILY_PUZZLE,
  createInitialAtBatUiState,
  createInitialDemoGameState,
} from './mockDailyPuzzle';

const IDENTITY: DailyAtBatAttemptIdentity = {
  id: DEMO_DAILY_PUZZLE.id,
  puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
  puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
};
const SESSION: DailyAtBatContributionSession = {
  status: 'active',
  attemptId: 'attempt-one',
  generation: 2,
  allowCompletedResultCreate: true,
};

describe('Daily gameplay save -> resolved-AB freeze edge', () => {
  it('never freezes when gameplay persistence fails', () => {
    const freeze = vi.fn();
    const result = persistGameplayThenFreezeDailyAtBats({
      persistGameplay: () => false,
      contribution: SESSION,
      identity: IDENTITY,
      saveInput: saveInput([atBat(1)]),
      freezeObservation: freeze,
    });

    expect(result).toEqual({
      saved: false,
      deliveryPitchNumbers: [],
      freezeFailure: null,
    });
    expect(freeze).not.toHaveBeenCalled();
  });

  it('persists first, freezes exact terminal facts, and schedules only newly created slots', () => {
    let persisted = false;
    const freeze = vi.fn((input: { atBat: DailyCompletedAtBat }) => {
      expect(persisted).toBe(true);
      return input.atBat.pitchNumber === 2 ? 'created' as const : 'existing' as const;
    });

    const result = persistGameplayThenFreezeDailyAtBats({
      persistGameplay: () => {
        persisted = true;
        return true;
      },
      contribution: SESSION,
      identity: IDENTITY,
      saveInput: saveInput([atBat(1), atBat(2)]),
      freezeObservation: freeze,
    });

    expect(result).toEqual({
      saved: true,
      deliveryPitchNumbers: [2],
      freezeFailure: null,
    });
    expect(freeze.mock.calls.map(call => call[0])).toEqual([
      { identity: IDENTITY, generation: 2, atBat: atBat(1) },
      { identity: IDENTITY, generation: 2, atBat: atBat(2) },
    ]);
  });

  it('uses pending-advance facts as the durable terminal set', () => {
    const freeze = vi.fn(() => 'created' as const);
    const input = saveInput([atBat(1)]);
    input.pendingAdvance = {
      inning: input.gameState.inning,
      score: input.gameState.score,
      points: input.gameState.points,
      completedAtBats: [atBat(1), atBat(2)],
      pitchLines: [
        { initials: 'P1', outcome: 'HR' },
        { initials: 'P2', outcome: 'HR' },
      ],
      nextPitchIndex: 2,
    };

    expect(persistGameplayThenFreezeDailyAtBats({
      persistGameplay: () => true,
      contribution: SESSION,
      identity: IDENTITY,
      saveInput: input,
      freezeObservation: freeze,
    }).deliveryPitchNumbers).toEqual([1, 2]);
  });

  it('fails closed on the first non-idempotent freeze result', () => {
    const freeze = vi.fn()
      .mockReturnValueOnce('existing')
      .mockReturnValueOnce('observation_conflict');

    expect(persistGameplayThenFreezeDailyAtBats({
      persistGameplay: () => true,
      contribution: SESSION,
      identity: IDENTITY,
      saveInput: saveInput([atBat(1), atBat(2), atBat(3)]),
      freezeObservation: freeze,
    })).toEqual({
      saved: true,
      deliveryPitchNumbers: [],
      freezeFailure: 'observation_conflict',
    });
    expect(freeze).toHaveBeenCalledTimes(2);
  });

  it('keeps compatibility/inactive saves out of the journal', () => {
    const freeze = vi.fn();
    const inactive: DailyAtBatContributionSession = {
      status: 'inactive',
      reason: 'legacy_save',
      allowCompletedResultCreate: true,
    };

    expect(persistGameplayThenFreezeDailyAtBats({
      persistGameplay: () => true,
      contribution: inactive,
      identity: IDENTITY,
      saveInput: saveInput([atBat(1)]),
      freezeObservation: freeze,
    })).toEqual({
      saved: true,
      deliveryPitchNumbers: [],
      freezeFailure: null,
    });
    expect(freeze).not.toHaveBeenCalled();
  });
});

function saveInput(completedAtBats: DailyCompletedAtBat[]): SaveDailyGameInput {
  const gameState = {
    ...createInitialDemoGameState(DEMO_DAILY_PUZZLE),
    completedAtBats,
    completedPitchLines: completedAtBats.map(atBat => ({
      initials: atBat.initials,
      outcome: atBat.outcome,
    })),
  };
  return {
    currentPitchIndex: completedAtBats.length,
    gameState,
    atBatState: createInitialAtBatUiState(),
    pendingAdvance: null,
    progressionToken: 'token',
    scorecardAnswers: {},
  };
}
function atBat(pitchNumber: number): DailyCompletedAtBat {
  return {
    pitchNumber,
    initials: 'P' + pitchNumber,
    outcome: 'HR',
    hintsRevealed: 0,
    wrongGuesses: 0,
    resolution: 'correct',
  };
}
