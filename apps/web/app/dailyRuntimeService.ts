import type { CanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import { getGuessOutcome } from '@initial-baseball/engine';
import {
  CURRENT_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  type DailyGuessResult,
  type DailyPuzzle,
  type DailyPublicPuzzle,
  type DailyRevealCount,
} from '@initial-baseball/shared';
import { createCanonicalRevealViewModel } from './canonicalRevealViewModel';
import {
  DailyProgressionTokenError,
  type DailyProgressionClaims,
  type DailyProgressionTokenCodec,
} from './dailyProgressionToken';
import type {
  DailyHintBundle,
  DailyResolutionRequest,
  DailyRuntimeService,
} from './dailyRuntimeContracts';

type CreateDailyRuntimeServiceInput = {
  canonicalRuntime: CanonicalRuntimeAccessor;
  createPuzzle: (date: string) => Promise<DailyPuzzle> | DailyPuzzle;
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
  async function createCanonicalPuzzle(date: string): Promise<DailyPuzzle> {
    const puzzle = await createPuzzle(date);
    if (puzzle.puzzleDate !== date) {
      throw new DailyRuntimeRequestError(`Daily puzzle ${puzzle.id} does not match requested date ${date}.`);
    }
    return {
      ...puzzle,
      pitches: puzzle.pitches.map(pitch => ({
        ...pitch,
        player: {
          ...pitch.player,
          playerId: canonicalRuntime.requireCanonicalPlayerId(pitch.player.playerId),
        },
      })),
    };
  }

  async function requireAuthorizedProgression(progressionToken: string): Promise<AuthorizedProgression> {
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
    const puzzle = await createCanonicalPuzzle(claims.puzzleDate);
    if (puzzle.id !== claims.puzzleId || puzzle.puzzleDate !== claims.puzzleDate) {
      throw new DailyRuntimeRequestError('Daily progression token does not match its puzzle.');
    }
    return {
      claims,
      puzzle,
      pitch: requirePitch(puzzle, claims.pitchNumber),
    };
  }

  function createHintBundle(authorized: AuthorizedProgression): DailyHintBundle {
    const hints = authorized.puzzle.hintConfig.map((hintSlot) => {
      const hintValue = authorized.pitch.hints[hintSlot.hintType];
      if (hintValue === undefined) {
        throw new DailyRuntimeRequestError(
          `Hint ${hintSlot.hintType} is unavailable for pitch ${authorized.claims.pitchNumber}.`,
        );
      }
      return {
        slot: hintSlot.slot,
        hintType: hintSlot.hintType,
        hintLabel: hintSlot.displayLabel,
        hintValue,
      };
    });

    const checkpoints = hints
      .filter(hint => hint.slot > authorized.claims.revealCount)
      .map(hint => ({
        revealedCount: hint.slot as DailyRevealCount,
        progressionToken: progressionTokens.sign({
          ...authorized.claims,
          revealCount: hint.slot as DailyProgressionClaims['revealCount'],
        }),
      }));

    return {
      pitchNumber: authorized.pitch.pitchNumber,
      revealedCount: authorized.claims.revealCount,
      hints,
      checkpoints,
    };
  }

  return {
    async getBootstrap(date) {
      const puzzle = await createCanonicalPuzzle(date);
      const firstPitch = puzzle.pitches[0];
      if (firstPitch === undefined) {
        throw new DailyRuntimeRequestError(`Daily puzzle ${puzzle.id} has no pitches.`);
      }
      const claims: DailyProgressionClaims = {
        version: 1,
        rulesetVersion: CURRENT_DAILY_RULESET_VERSION,
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        pitchNumber: firstPitch.pitchNumber,
        revealCount: 0,
        strikeCount: 0,
        outCount: 0,
        completed: false,
      };
      return {
        puzzle: toPublicPuzzle(puzzle),
        progressionToken: progressionTokens.sign(claims),
        hintBundle: createHintBundle({ claims, puzzle, pitch: firstPitch }),
      };
    },

    async getHintBundle(progressionToken) {
      const authorized = await requireAuthorizedProgression(progressionToken);
      return {
        hintBundle: createHintBundle(authorized),
      };
    },

    async revealHint(progressionToken) {
      const authorized = await requireAuthorizedProgression(progressionToken);
      const bundle = createHintBundle(authorized);
      const hint = bundle.hints[authorized.claims.revealCount];
      const checkpoint = bundle.checkpoints.find(
        candidate => candidate.revealedCount === authorized.claims.revealCount + 1,
      );
      if (hint === undefined || checkpoint === undefined) {
        throw new DailyRuntimeRequestError(
          `No additional hint exists for pitch ${authorized.claims.pitchNumber}.`,
        );
      }
      return {
        hint: {
          hintType: hint.hintType,
          hintLabel: hint.hintLabel,
          hintValue: hint.hintValue,
        },
        progressionToken: checkpoint.progressionToken,
      };
    },

    async resolveAtBat(request) {
      const authorized = await requireAuthorizedProgression(request.progressionToken);
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
      const successorClaims = createSuccessorClaims(authorized, result);
      const progressionToken = progressionTokens.sign(successorClaims);
      const successorBundle = successorClaims.completed
        ? null
        : createHintBundle({
            claims: successorClaims,
            puzzle: authorized.puzzle,
            pitch: requirePitch(authorized.puzzle, successorClaims.pitchNumber),
          });

      return {
        result,
        reveal: isTerminal
          ? createCanonicalRevealViewModel(
              canonicalRuntime.getReveal(authorized.pitch.player.playerId),
            )
          : null,
        progressionToken,
        hintBundle: successorBundle,
      };
    },
  };
}

export function toPublicPuzzle(puzzle: DailyPuzzle): DailyPublicPuzzle {
  return {
    id: puzzle.id,
    puzzleNumber: puzzle.puzzleNumber,
    puzzleDate: puzzle.puzzleDate,
    status: puzzle.status,
    hintConfig: puzzle.hintConfig,
    statsHintConfig: puzzle.statsHintConfig,
    pitches: puzzle.pitches.map(pitch => ({
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
  const completedByLegacyOuts = authorized.claims.rulesetVersion === LEGACY_DAILY_RULESET_VERSION
    && nextOutCount === 3;
  const completed = completedByLegacyOuts || nextPitch === undefined;

  return {
    version: 1,
    rulesetVersion: authorized.claims.rulesetVersion,
    puzzleId: authorized.claims.puzzleId,
    puzzleDate: authorized.claims.puzzleDate,
    pitchNumber: completed ? authorized.claims.pitchNumber : nextPitch.pitchNumber,
    revealCount: 0,
    strikeCount: 0,
    outCount: nextOutCount,
    completed,
  };
}

function requirePitch(
  puzzle: DailyPuzzle,
  pitchNumber: number,
): DailyPuzzle['pitches'][number] {
  const pitch = puzzle.pitches.find(candidate => candidate.pitchNumber === pitchNumber);
  if (pitch === undefined) {
    throw new DailyRuntimeRequestError(
      `Unknown pitch ${pitchNumber} for ${puzzle.puzzleDate}.`,
    );
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
    throw new DailyRuntimeRequestError(
      'submittedPlayerId does not resolve to a canonical player.',
    );
  }
}

function incrementOutCount(
  value: DailyProgressionClaims['outCount'],
): DailyProgressionClaims['outCount'] {
  return Math.min(value + 1, 3) as DailyProgressionClaims['outCount'];
}
