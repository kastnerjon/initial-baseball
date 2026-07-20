import type { CanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import { getGuessOutcome } from '@initial-baseball/engine';
import type { DailyGuessResult, DailyPuzzle, DailyPublicPuzzle } from '@initial-baseball/shared';
import { createCanonicalRevealViewModel } from './canonicalRevealViewModel';
import {
  DailyProgressionTokenError,
  type DailyProgressionClaims,
  type DailyProgressionTokenCodec,
} from './dailyProgressionToken';
import type {
  DailyResolutionRequest,
  DailyRuntimeService,
} from './dailyRuntimeContracts';

type CreateDailyRuntimeServiceInput = {
  canonicalRuntime: CanonicalRuntimeAccessor;
  createPuzzle: (date: string) => DailyPuzzle;
  progressionTokens: DailyProgressionTokenCodec;
};

type AuthorizedProgression = {
  claims: DailyProgressionClaims;
  puzzle: DailyPuzzle;
  pitch: DailyPuzzle['pitches'][number];
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
  progressionTokens,
}: CreateDailyRuntimeServiceInput): DailyRuntimeService {
  return {
    getBootstrap(date) {
      const puzzle = createCanonicalPuzzle(date);
      const firstPitch = puzzle.pitches[0];
      if (firstPitch === undefined) {
        throw new DailyRuntimeRequestError(`Daily puzzle ${puzzle.id} has no pitches.`);
      }
      return {
        puzzle: toPublicPuzzle(puzzle),
        progressionToken: progressionTokens.sign({
          version: 1,
          puzzleId: puzzle.id,
          puzzleDate: puzzle.puzzleDate,
          pitchNumber: firstPitch.pitchNumber,
          revealCount: 0,
          strikeCount: 0,
          outCount: 0,
          completed: false,
        }),
      };
    },
    revealHint(progressionToken) {
      const { claims, puzzle, pitch } = requireAuthorizedProgression(progressionToken);
      const hintSlot = puzzle.hintConfig[claims.revealCount];
      if (hintSlot === undefined) {
        throw new DailyRuntimeRequestError(`No additional hint exists for pitch ${claims.pitchNumber}.`);
      }
      const hintValue = pitch.hints[hintSlot.hintType];
      if (hintValue === undefined) {
        throw new DailyRuntimeRequestError(`Hint ${hintSlot.hintType} is unavailable for pitch ${claims.pitchNumber}.`);
      }
      return {
        hint: {
          hintType: hintSlot.hintType,
          hintLabel: hintSlot.displayLabel,
          hintValue,
        },
        progressionToken: progressionTokens.sign({
          ...claims,
          revealCount: incrementRevealCount(claims.revealCount),
        }),
      };
    },
    resolveAtBat(request) {
      const authorized = requireAuthorizedProgression(request.progressionToken);
      const submittedPlayerId = resolveSubmittedPlayerId(request, canonicalRuntime);
      const isCorrect = submittedPlayerId === authorized.pitch.player.playerId;
      const result = request.giveUp === true
        ? {
            kind: 'strikeout' as const,
            revealedCount: authorized.claims.revealCount,
            strikeCount: 3,
            outcome: 'K' as const,
            source: 'strikeout' as const,
          }
        : getGuessOutcome({
            isCorrect,
            revealCount: authorized.claims.revealCount,
            strikeCount: authorized.claims.strikeCount,
            maxStrikes: 3,
          });
      const isTerminal = result.kind === 'correct' || result.kind === 'strikeout';
      return {
        result,
        reveal: isTerminal
          ? createCanonicalRevealViewModel(canonicalRuntime.getReveal(authorized.pitch.player.playerId))
          : null,
        progressionToken: progressionTokens.sign(createSuccessorClaims(authorized, result)),
      };
    },
  };

  function requireAuthorizedProgression(progressionToken: string): AuthorizedProgression {
    let claims: DailyProgressionClaims;
    try {
      claims = progressionTokens.verify(progressionToken);
    } catch (error) {
      if (error instanceof DailyProgressionTokenError) {
        throw new DailyRuntimeRequestError('Invalid Daily progression token.');
      }
      throw error;
    }

    if (claims.completed) {
      throw new DailyRuntimeRequestError('This Daily progression token is already complete.');
    }

    const puzzle = createCanonicalPuzzle(claims.puzzleDate);
    if (puzzle.id !== claims.puzzleId || puzzle.puzzleDate !== claims.puzzleDate) {
      throw new DailyRuntimeRequestError('Daily progression token does not match its puzzle.');
    }

    return {
      claims,
      puzzle,
      pitch: requirePitch(puzzle, claims.pitchNumber),
    };
  }

  function createCanonicalPuzzle(date: string): DailyPuzzle {
    const puzzle = createPuzzle(date);
    if (puzzle.puzzleDate !== date) {
      throw new DailyRuntimeRequestError(`Daily puzzle ${puzzle.id} does not match requested date ${date}.`);
    }
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

function createSuccessorClaims(
  authorized: AuthorizedProgression,
  result: DailyGuessResult,
): DailyProgressionClaims {
  if (result.kind === 'incorrect') {
    return {
      ...authorized.claims,
      strikeCount: result.strikeCount as 1 | 2,
    };
  }

  const nextOutCount = result.kind === 'strikeout'
    ? incrementOutCount(authorized.claims.outCount)
    : authorized.claims.outCount;
  const currentPitchIndex = authorized.puzzle.pitches.findIndex(
    candidate => candidate.pitchNumber === authorized.claims.pitchNumber,
  );
  const nextPitch = authorized.puzzle.pitches[currentPitchIndex + 1];
  const completed = nextOutCount === 3 || nextPitch === undefined;

  return {
    version: 1,
    puzzleId: authorized.claims.puzzleId,
    puzzleDate: authorized.claims.puzzleDate,
    pitchNumber: completed ? authorized.claims.pitchNumber : nextPitch.pitchNumber,
    revealCount: 0,
    strikeCount: 0,
    outCount: nextOutCount,
    completed,
  };
}

function requirePitch(puzzle: DailyPuzzle, pitchNumber: number): DailyPuzzle['pitches'][number] {
  const pitch = puzzle.pitches.find(candidate => candidate.pitchNumber === pitchNumber);
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
  try {
    return canonicalRuntime.requireCanonicalPlayerId(submittedPlayerId);
  } catch {
    throw new DailyRuntimeRequestError('submittedPlayerId does not resolve to a canonical player.');
  }
}

function incrementRevealCount(value: DailyProgressionClaims['revealCount']): DailyProgressionClaims['revealCount'] {
  if (value >= 4) {
    throw new DailyRuntimeRequestError('All Daily hints are already revealed.');
  }
  return (value + 1) as DailyProgressionClaims['revealCount'];
}

function incrementOutCount(value: DailyProgressionClaims['outCount']): DailyProgressionClaims['outCount'] {
  return Math.min(value + 1, 3) as DailyProgressionClaims['outCount'];
}
