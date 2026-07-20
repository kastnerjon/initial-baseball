import type { CanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import { getGuessOutcome } from '@initial-baseball/engine';
import type {
  DailyGuessResult,
  DailyPuzzle,
  DailyPublicPuzzle,
  DailyRevealCount,
} from '@initial-baseball/shared';
import { createCanonicalRevealViewModel } from './canonicalRevealViewModel';
import {
  createInitialDailyProgressionToken,
  signDailyProgressionState,
  verifyDailyProgressionToken,
  type DailyProgressionState,
} from './dailyProgressionToken';
import type {
  DailyHintRequest,
  DailyResolutionRequest,
  DailyRuntimeService,
} from './dailyRuntimeContracts';

type CreateDailyRuntimeServiceInput = {
  canonicalRuntime: CanonicalRuntimeAccessor;
  createPuzzle: (date: string) => DailyPuzzle;
};

export class DailyRuntimeRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyRuntimeRequestError';
  }
}

export function createDailyRuntimeService({
  canonicalRuntime,
  createPuzzle,
}: CreateDailyRuntimeServiceInput): DailyRuntimeService {
  return {
    getPublicSession(date) {
      const puzzle = createCanonicalPuzzle(date);
      return {
        puzzle: toPublicPuzzle(puzzle),
        progressionToken: createInitialDailyProgressionToken(puzzle),
      };
    },

    revealHint(request) {
      const { puzzle, state } = requireProgression(request);
      const pitch = requirePitch(puzzle, state.pitchNumber);
      const hintSlot = puzzle.hintConfig[state.revealCount];
      if (hintSlot === undefined) {
        throw new DailyRuntimeRequestError(
          `No hint ${state.revealCount + 1} exists for pitch ${state.pitchNumber}.`,
        );
      }

      const hintValue = pitch.hints[hintSlot.hintType];
      if (hintValue === undefined) {
        throw new DailyRuntimeRequestError(
          `Hint ${hintSlot.hintType} is unavailable for pitch ${state.pitchNumber}.`,
        );
      }

      const nextRevealCount = (state.revealCount + 1) as DailyRevealCount;
      return {
        hint: {
          hintType: hintSlot.hintType,
          hintLabel: hintSlot.displayLabel,
          hintValue,
        },
        progressionToken: signDailyProgressionState(puzzle, {
          ...state,
          revealCount: nextRevealCount,
        }),
      };
    },

    resolveAtBat(request) {
      const { puzzle, state } = requireProgression(request);
      const pitch = requirePitch(puzzle, state.pitchNumber);
      const submittedPlayerId = resolveSubmittedPlayerId(request, canonicalRuntime);
      const isCorrect = submittedPlayerId === pitch.player.playerId;
      const result = request.giveUp === true
        ? {
            kind: 'strikeout' as const,
            revealedCount: state.revealCount,
            strikeCount: 3,
            outcome: 'K' as const,
            source: 'strikeout' as const,
          }
        : getGuessOutcome({
            isCorrect,
            revealCount: state.revealCount,
            strikeCount: state.strikeCount,
            maxStrikes: 3,
          });
      const isTerminal = result.kind === 'correct' || result.kind === 'strikeout';

      return {
        result,
        reveal: isTerminal
          ? createCanonicalRevealViewModel(canonicalRuntime.getReveal(pitch.player.playerId))
          : null,
        progressionToken: createNextProgressionToken(puzzle, state, result),
      };
    },
  };

  function createCanonicalPuzzle(date: string): DailyPuzzle {
    const puzzle = createPuzzle(date);
    return {
      ...puzzle,
      pitches: puzzle.pitches.map((pitch) => ({
        ...pitch,
        player: {
          ...pitch.player,
          playerId: canonicalRuntime.requireCanonicalPlayerId(pitch.player.playerId),
        },
      })),
    };
  }

  function requireProgression(
    request: DailyHintRequest | DailyResolutionRequest,
  ): { puzzle: DailyPuzzle; state: DailyProgressionState } {
    const puzzle = createCanonicalPuzzle(request.puzzleDate);
    try {
      return {
        puzzle,
        state: verifyDailyProgressionToken(puzzle, request.progressionToken),
      };
    } catch {
      throw new DailyRuntimeRequestError('Invalid or stale Daily progression token.');
    }
  }
}

export function toPublicPuzzle(puzzle: DailyPuzzle): DailyPublicPuzzle {
  return {
    id: puzzle.id,
    puzzleNumber: puzzle.puzzleNumber,
    puzzleDate: puzzle.puzzleDate,
    status: puzzle.status,
    hintConfig: puzzle.hintConfig,
    statsHintConfig: puzzle.statsHintConfig,
    pitches: puzzle.pitches.map((pitch) => ({
      pitchNumber: pitch.pitchNumber,
      initials: pitch.player.initials,
    })),
  };
}

function requirePitch(puzzle: DailyPuzzle, pitchNumber: number): DailyPuzzle['pitches'][number] {
  const pitch = puzzle.pitches.find((candidate) => candidate.pitchNumber === pitchNumber);
  if (pitch === undefined) {
    throw new DailyRuntimeRequestError(`Unknown pitch ${pitchNumber} for ${puzzle.puzzleDate}.`);
  }
  return pitch;
}

function resolveSubmittedPlayerId(
  request: DailyResolutionRequest,
  canonicalRuntime: CanonicalRuntimeAccessor,
): string | null {
  if (request.giveUp === true) {
    return null;
  }

  const submittedPlayerId = request.submittedPlayerId?.trim();
  if (!submittedPlayerId) {
    throw new DailyRuntimeRequestError('submittedPlayerId is required for a guess.');
  }
  return canonicalRuntime.requireCanonicalPlayerId(submittedPlayerId);
}

function createNextProgressionToken(
  puzzle: DailyPuzzle,
  state: DailyProgressionState,
  result: DailyGuessResult,
): string | null {
  if (result.kind === 'incorrect') {
    return signDailyProgressionState(puzzle, {
      ...state,
      strikeCount: result.strikeCount,
    });
  }

  const nextOuts = state.outs + (result.kind === 'strikeout' ? 1 : 0);
  const currentPitchIndex = puzzle.pitches.findIndex(
    (pitch) => pitch.pitchNumber === state.pitchNumber,
  );
  const nextPitch = puzzle.pitches[currentPitchIndex + 1];

  if (nextOuts >= 3 || nextPitch === undefined) {
    return null;
  }

  return signDailyProgressionState(puzzle, {
    version: state.version,
    puzzleId: state.puzzleId,
    puzzleDate: state.puzzleDate,
    pitchNumber: nextPitch.pitchNumber,
    revealCount: 0,
    strikeCount: 0,
    outs: nextOuts,
  });
}
