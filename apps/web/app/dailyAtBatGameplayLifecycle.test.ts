import { POINTS_V3_DAILY_RULESET_VERSION, type DailyCompletedAtBat } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import type { DailyAtBatAttemptIdentity } from './dailyAtBatAttemptJournal';
import { createDailyAtBatGameplayLifecycle } from './dailyAtBatGameplayLifecycle';
import type { LoadedSavedDailyGame, SavedDailyGame } from './dailyLocalStorage';
import { createInitialAtBatUiState, createInitialDemoGameState, DEMO_DAILY_PUZZLE } from './mockDailyPuzzle';

const IDENTITY: DailyAtBatAttemptIdentity = {
  id: DEMO_DAILY_PUZZLE.id, puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
  puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber, rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
};

describe('Daily at-bat gameplay lifecycle', () => {
  it.each([
    ['fresh', null, false, 'active', undefined],
    ['unusable persisted', null, true, 'inactive', 'unusable_save'],
    ['pre-rollout', loadedGame(), true, 'inactive', 'legacy_save'],
  ] as const)('classifies %s owner preparation without synthesizing history', (
    _label, loaded, hadPersistedGameplayValue, status, reason,
  ) => {
    const lifecycle = makeLifecycle(memoryStorage());
    const prepared = lifecycle.prepareOwner({
      loaded, hadPersistedGameplayValue, claimedGeneration: null, totalAtBats: 6,
    });
    expect(prepared).toMatchObject(reason === undefined ? {
      status, attemptId: 'attempt-one', generation: 1, allowCompletedResultCreate: true,
    } : {
      status, reason, allowCompletedResultCreate: true,
    });
    expect(lifecycle.journal.read(IDENTITY)).toMatchObject(
      status === 'active'
        ? { kind: 'valid', journal: { attemptId: 'attempt-one', generation: 1 } }
        : { kind: 'missing' },
    );
  });

  it('accepts takeover only when durable terminal facts match exactly', () => {
    const storage = memoryStorage();
    const first = makeLifecycle(storage);
    const atBat = completedAtBat(1);
    first.journal.create(IDENTITY);
    first.journal.appendObservation({ identity: IDENTITY, generation: 1, atBat });
    const takeover = makeLifecycle(storage);
    takeover.journal.advanceGeneration(IDENTITY);

    expect(takeover.prepareOwner({
      loaded: loadedGame([atBat]), hadPersistedGameplayValue: true,
      claimedGeneration: 2, totalAtBats: 6,
    })).toMatchObject({ status: 'active', attemptId: 'attempt-one', generation: 2 });
  });

  it('retires rather than backfilling when gameplay is ahead of the journal', () => {
    const storage = memoryStorage();
    const lifecycle = makeLifecycle(storage);
    lifecycle.journal.create(IDENTITY);
    lifecycle.journal.advanceGeneration(IDENTITY);

    expect(lifecycle.prepareOwner({
      loaded: loadedGame([completedAtBat(1)]), hadPersistedGameplayValue: true,
      claimedGeneration: 2, totalAtBats: 6,
    })).toEqual({
      status: 'inactive', reason: 'durable_mismatch', allowCompletedResultCreate: false,
    });
    expect(lifecycle.journal.read(IDENTITY)).toMatchObject({
      kind: 'valid', journal: { contributionState: 'retired' },
    });
  });

  it.each([
    [false, 'active', undefined],
    [true, 'inactive', 'durable_mismatch'],
  ] as const)('treats empty-journal takeover by current gameplay-key presence', (
    hadPersistedGameplayValue, status, reason,
  ) => {
    const storage = memoryStorage();
    const first = makeLifecycle(storage);
    first.journal.create(IDENTITY);
    const takeover = makeLifecycle(storage);
    takeover.journal.advanceGeneration(IDENTITY);

    const prepared = takeover.prepareOwner({
      loaded: null, hadPersistedGameplayValue, claimedGeneration: 2, totalAtBats: 6,
    });
    expect(prepared).toMatchObject(
      reason === undefined ? { status, generation: 2 } : { status, reason },
    );
  });

  it('keeps an empty attempt across reset, then retires it once observations exist', () => {
    const lifecycle = makeLifecycle(memoryStorage());
    const fresh = lifecycle.prepareOwner({
      loaded: null, hadPersistedGameplayValue: false, claimedGeneration: null, totalAtBats: 6,
    });
    expect(lifecycle.resetContribution(fresh)).toMatchObject({
      status: 'active', generation: 1, allowCompletedResultCreate: true,
    });

    lifecycle.journal.appendObservation({
      identity: IDENTITY, generation: 1, atBat: completedAtBat(1),
    });
    expect(lifecycle.resetContribution(fresh)).toEqual({
      status: 'inactive', reason: 'retired', allowCompletedResultCreate: false,
    });
    expect(lifecycle.journal.read(IDENTITY)).toMatchObject({
      kind: 'valid', journal: { contributionState: 'retired' },
    });
  });

  it('fails contribution closed after terminal delivery failure', () => {
    const lifecycle = makeLifecycle(memoryStorage());
    const fresh = lifecycle.prepareOwner({
      loaded: null, hadPersistedGameplayValue: false, claimedGeneration: null, totalAtBats: 6,
    });
    expect(lifecycle.retireAfterDeliveryFailure(fresh)).toEqual({
      status: 'inactive', reason: 'delivery_failure', allowCompletedResultCreate: false,
    });
    expect(lifecycle.journal.read(IDENTITY)).toMatchObject({
      kind: 'valid', journal: { contributionState: 'retired' },
    });
  });

  it('fails contribution closed after a gameplay-save failure', () => {
    const lifecycle = makeLifecycle(memoryStorage());
    const fresh = lifecycle.prepareOwner({
      loaded: null, hadPersistedGameplayValue: false, claimedGeneration: null, totalAtBats: 6,
    });
    expect(lifecycle.retireAfterGameplaySaveFailure(fresh)).toEqual({
      status: 'inactive', reason: 'save_failure', allowCompletedResultCreate: false,
    });
    expect(lifecycle.journal.read(IDENTITY)).toMatchObject({
      kind: 'valid', journal: { contributionState: 'retired' },
    });
  });
});

function makeLifecycle(storage: ReturnType<typeof memoryStorage>) {
  return createDailyAtBatGameplayLifecycle({
    identity: IDENTITY, storage, createAttemptId: () => 'attempt-one',
  });
}
function loadedGame(completedAtBats: DailyCompletedAtBat[] = []): LoadedSavedDailyGame {
  const gameState = {
    ...createInitialDemoGameState(DEMO_DAILY_PUZZLE), completedAtBats,
    completedPitchLines: completedAtBats.map(atBat => ({
      initials: atBat.initials, outcome: atBat.outcome,
    })),
  };
  const savedGame: SavedDailyGame = {
    schemaVersion: 3, puzzleId: DEMO_DAILY_PUZZLE.id,
    puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate, puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
    currentPitchIndex: completedAtBats.length, gameState,
    atBatState: createInitialAtBatUiState(), pendingAdvance: null,
    progressionToken: 'token', scorecardAnswers: {},
  };
  return { savedGame, completedAtBatFactsAreNative: true };
}
function completedAtBat(pitchNumber: number): DailyCompletedAtBat {
  return { pitchNumber, initials: 'P' + pitchNumber, outcome: 'HR',
    hintsRevealed: 0, wrongGuesses: 0, resolution: 'correct' };
}
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
  };
}
