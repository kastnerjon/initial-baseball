import type { PermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import { clonePermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import { createCustomNineLineupSelection } from './customNineLineup';

export const CUSTOM_NINE_ISSUED_CHALLENGE_SCHEMA_VERSION = 1 as const;
export const CUSTOM_NINE_RULESET_VERSION = 'points-v4' as const;

// A future server adapter generates a cryptographically random UUIDv4. This
// pure domain layer validates the shape without minting IDs or accessing a clock.
const CUSTOM_NINE_PUZZLE_ID = /^custom-nine-v1-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type CustomNineIssuedChallengeInput = {
  readonly puzzleId: string;
  readonly canonicalPlayerIds: readonly string[];
  readonly clueSnapshot: PermanentDailyIssuedClueSnapshot;
  readonly issuedAt: string;
};

export type CustomNineIssuedChallenge = Readonly<{
  schemaVersion: typeof CUSTOM_NINE_ISSUED_CHALLENGE_SCHEMA_VERSION;
  puzzleId: string;
  rulesetVersion: typeof CUSTOM_NINE_RULESET_VERSION;
  canonicalPlayerIds: readonly string[];
  clueSnapshot: PermanentDailyIssuedClueSnapshot;
  issuedAt: string;
}>;

/** Private issued record. Never serialize it into an anonymous page or route. */
export function createCustomNineIssuedChallenge(input: CustomNineIssuedChallengeInput): CustomNineIssuedChallenge {
  validateCustomNinePuzzleId(input.puzzleId);
  const lineup = createCustomNineLineupSelection(input.canonicalPlayerIds);
  const snapshot = clonePermanentDailyIssuedClueSnapshot(input.clueSnapshot);
  snapshot.pitches.forEach((pitch, index) => {
    if (pitch.canonicalPlayerId !== lineup.canonicalPlayerIds[index]) {
      throw new Error('Custom Nine clue snapshot does not match the selected player order.');
    }
  });
  const issuedAt = normalizeIssuedAt(input.issuedAt);
  return Object.freeze({
    schemaVersion: CUSTOM_NINE_ISSUED_CHALLENGE_SCHEMA_VERSION,
    puzzleId: input.puzzleId,
    rulesetVersion: CUSTOM_NINE_RULESET_VERSION,
    canonicalPlayerIds: lineup.canonicalPlayerIds,
    clueSnapshot: freezeSnapshot(snapshot),
    issuedAt,
  });
}

export function cloneCustomNineIssuedChallenge(challenge: CustomNineIssuedChallenge): CustomNineIssuedChallenge {
  if (challenge.schemaVersion !== CUSTOM_NINE_ISSUED_CHALLENGE_SCHEMA_VERSION
    || challenge.rulesetVersion !== CUSTOM_NINE_RULESET_VERSION) {
    throw new Error('Unsupported Custom Nine issued challenge version.');
  }
  return createCustomNineIssuedChallenge(challenge);
}

export function validateCustomNinePuzzleId(puzzleId: string): void {
  if (typeof puzzleId !== 'string' || !CUSTOM_NINE_PUZZLE_ID.test(puzzleId)) {
    throw new Error('Invalid Custom Nine puzzle ID.');
  }
}

function normalizeIssuedAt(issuedAt: string): string {
  if (typeof issuedAt !== 'string' || issuedAt.length < 20 || issuedAt.length > 40) {
    throw new Error('Invalid Custom Nine issue timestamp.');
  }
  const timestamp = Date.parse(issuedAt);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid Custom Nine issue timestamp.');
  return new Date(timestamp).toISOString();
}

function freezeSnapshot(snapshot: PermanentDailyIssuedClueSnapshot): PermanentDailyIssuedClueSnapshot {
  for (const hint of snapshot.hintLayout) Object.freeze(hint);
  for (const pitch of snapshot.pitches) {
    Object.freeze(pitch.hintValues);
    Object.freeze(pitch);
  }
  Object.freeze(snapshot.hintLayout);
  Object.freeze(snapshot.pitches);
  return Object.freeze(snapshot);
}
