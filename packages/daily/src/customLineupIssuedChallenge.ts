import {
  cloneCustomLineupIssuedClueSnapshot,
  type PermanentDailyIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';
import { createCustomLineupSelection } from './customLineupSelection';
import { CUSTOM_NINE_RULESET_VERSION } from './customNineIssuedChallenge';
import { freezeCustomClueSnapshot, normalizeCustomIssuedAt } from './customIssuedChallengeShared';

export const CUSTOM_LINEUP_ISSUED_CHALLENGE_SCHEMA_VERSION = 2 as const;
export const DEFAULT_CUSTOM_LINEUP_STRIKE_LIMIT = 3 as const;
export type CustomLineupStrikeLimit = 1 | 2 | 3;
export const CUSTOM_LINEUP_RULESET_VERSION = CUSTOM_NINE_RULESET_VERSION;

const CUSTOM_LINEUP_PUZZLE_ID =
  /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const UNSUPPORTED_HINT_VALUES = new Set(['Unknown', 'Teams unavailable', 'Stats unavailable']);

export type CustomLineupIssuedChallengeInput = {
  readonly puzzleId: string;
  readonly canonicalPlayerIds: readonly string[];
  readonly clueSnapshot: PermanentDailyIssuedClueSnapshot;
  readonly issuedAt: string;
  /** Immutable rule for the whole lineup; omitted only by historical callers. */
  readonly strikeLimit?: CustomLineupStrikeLimit;
};

export type CustomLineupIssuedChallenge = Readonly<{
  schemaVersion: typeof CUSTOM_LINEUP_ISSUED_CHALLENGE_SCHEMA_VERSION;
  puzzleId: string;
  rulesetVersion: typeof CUSTOM_LINEUP_RULESET_VERSION;
  canonicalPlayerIds: readonly string[];
  clueSnapshot: PermanentDailyIssuedClueSnapshot;
  issuedAt: string;
  strikeLimit: CustomLineupStrikeLimit;
}>;

/**
 * Private immutable version-2 contract, NOT a producer, repository adapter,
 * response DTO, or competition admission. No browser should receive this.
 */
export function createCustomLineupIssuedChallenge(
  input: CustomLineupIssuedChallengeInput,
): CustomLineupIssuedChallenge {
  validateCustomLineupPuzzleId(input.puzzleId);
  const selection = createCustomLineupSelection(input.canonicalPlayerIds);
  const strikeLimit = input.strikeLimit ?? DEFAULT_CUSTOM_LINEUP_STRIKE_LIMIT;
  if (strikeLimit !== 1 && strikeLimit !== 2 && strikeLimit !== 3) {
    throw new Error('Custom Lineup strike limit must be 1, 2, or 3.');
  }
  const snapshot = cloneCustomLineupIssuedClueSnapshot(input.clueSnapshot);
  if (snapshot.pitches.length !== selection.canonicalPlayerIds.length) {
    throw new Error('Custom Lineup clue snapshot length must match the selected players.');
  }
  snapshot.pitches.forEach((pitch, index) => {
    if (pitch.canonicalPlayerId !== selection.canonicalPlayerIds[index]) {
      throw new Error('Custom Lineup clue snapshot does not match the selected player order.');
    }
    if (pitch.hintValues.some(value => UNSUPPORTED_HINT_VALUES.has(value))) {
      throw new Error('Custom Lineup requires complete supported clue values.');
    }
  });

  return Object.freeze({
    schemaVersion: CUSTOM_LINEUP_ISSUED_CHALLENGE_SCHEMA_VERSION,
    puzzleId: input.puzzleId,
    rulesetVersion: CUSTOM_LINEUP_RULESET_VERSION,
    strikeLimit,
    canonicalPlayerIds: selection.canonicalPlayerIds,
    clueSnapshot: freezeCustomClueSnapshot(snapshot),
    issuedAt: normalizeCustomIssuedAt(input.issuedAt),
  });
}

export function cloneCustomLineupIssuedChallenge(
  challenge: CustomLineupIssuedChallenge,
): CustomLineupIssuedChallenge {
  if (challenge.schemaVersion !== CUSTOM_LINEUP_ISSUED_CHALLENGE_SCHEMA_VERSION
    || challenge.rulesetVersion !== CUSTOM_LINEUP_RULESET_VERSION) {
    throw new Error('Unsupported Custom Lineup issued challenge version.');
  }
  return createCustomLineupIssuedChallenge(challenge);
}

export function validateCustomLineupPuzzleId(puzzleId: string): void {
  if (typeof puzzleId !== 'string' || !CUSTOM_LINEUP_PUZZLE_ID.test(puzzleId)) {
    throw new Error('Invalid Custom Lineup puzzle ID.');
  }
}
