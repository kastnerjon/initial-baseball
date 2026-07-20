import type { CanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import { getGuessOutcome } from '@initial-baseball/engine';
import type { DailyPuzzle, DailyPublicPuzzle } from '@initial-baseball/shared';
import { createCanonicalRevealViewModel } from './canonicalRevealViewModel';
import type {
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
    getPublicPuzzle(date) {
      return toPublicPuzzle(createCanonicalPuzzle(date));
    },
    revealHint(date, pitchNumber, revealCount) {
      const puzzle = createCanonicalPuzzle(date);
      const pitch = requirePitch(puzzle, pitchNumber);
      const hintSlot = puzzle.hintConfig[revealCount];
      if (hintSlot === undefined) {
        throw new DailyRuntimeRequestError(`No hint ${revealCount + 1} exists for pitch ${pitchNumber}.`);
      }
      const hintValue = pitch.hints[hintSlot.hintType];
      if (hintValue === undefined) {
        throw new DailyRuntimeRequestError(`Hint ${hintSlot.hintType} is unavailable for pitch ${pitchNumber}.`);
      }
      return {
        hint: {
          hintType: hintSlot.hintType,
          hintLabel: hintSlot.displayLabel,
          hintValue,
        },
      };
    },
    resolveAtBat(request) {
      const puzzle = createCanonicalPuzzle(request.puzzleDate);
      const pitch = requirePitch(puzzle, request.pitchNumber);
      const submittedPlayerId = resolveSubmittedPlayerId(request, canonicalRuntime);
      const isCorrect = submittedPlayerId === pitch.player.playerId;
      const result = request.giveUp === true
        ? {
            kind: 'strikeout' as const,
            revealedCount: request.revealCount,
            strikeCount: 3,
            outcome: 'K' as const,
            source: 'strikeout' as const,
          }
        : getGuessOutcome({
            isCorrect,
            revealCount: request.revealCount,
            strikeCount: request.strikeCount,
            maxStrikes: 3,
          });
      const isTerminal = result.kind === 'correct' || result.kind === 'strikeout';
      return {
        result,
        reveal: isTerminal
          ? createCanonicalRevealViewModel(canonicalRuntime.getReveal(pitch.player.playerId))
          : null,
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
