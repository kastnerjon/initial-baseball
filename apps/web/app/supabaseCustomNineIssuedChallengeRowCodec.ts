import 'server-only';
import {
  CUSTOM_NINE_ISSUED_CHALLENGE_SCHEMA_VERSION,
  CUSTOM_NINE_RULESET_VERSION,
  cloneCustomNineIssuedChallenge,
  createCustomNineIssuedChallenge,
  type CustomNineIssuedChallenge,
} from '@initial-baseball/daily';
import {
  decodeIssuedDailyClueSnapshot,
  record,
  stringArray,
  text,
  timestamp,
} from './supabaseIssuedDailyPuzzleRowCodecSupport';

export type CustomNineIssuedChallengeRow = {
  puzzle_id: string;
  schema_version: number;
  ruleset_version: string;
  canonical_player_ids: string[];
  clue_snapshot: unknown;
  issued_at: string;
};

export type SupabaseCustomNineIssuedChallengeRepositoryErrorKind = 'invalid-row' | 'query';

export class SupabaseCustomNineIssuedChallengeRepositoryError extends Error {
  constructor(
    public readonly kind: SupabaseCustomNineIssuedChallengeRepositoryErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseCustomNineIssuedChallengeRepositoryError';
  }
}

/** Private answer-bearing data. Never export through a public loader or response. */
export function encodeCustomNineIssuedChallengeRow(
  challenge: CustomNineIssuedChallenge,
): CustomNineIssuedChallengeRow {
  return validateRecord(() => {
    const current = cloneCustomNineIssuedChallenge(challenge);
    return {
      puzzle_id: current.puzzleId,
      schema_version: current.schemaVersion,
      ruleset_version: current.rulesetVersion,
      canonical_player_ids: [...current.canonicalPlayerIds],
      clue_snapshot: {
        schemaVersion: current.clueSnapshot.schemaVersion,
        hintLayout: current.clueSnapshot.hintLayout.map((hint) => ({ ...hint })),
        pitches: current.clueSnapshot.pitches.map((pitch) => ({
          pitchNumber: pitch.pitchNumber,
          canonicalPlayerId: pitch.canonicalPlayerId,
          initials: pitch.initials,
          hintValues: [...pitch.hintValues],
        })),
      },
      issued_at: current.issuedAt,
    };
  });
}

export function decodeCustomNineIssuedChallengeRow(row: unknown): CustomNineIssuedChallenge {
  return validateRecord(() => {
    const value = record(row, 'Custom Nine issued challenge');
    if (value.schema_version !== CUSTOM_NINE_ISSUED_CHALLENGE_SCHEMA_VERSION
      || value.ruleset_version !== CUSTOM_NINE_RULESET_VERSION) {
      throw new Error('Unsupported Custom Nine stored version.');
    }
    return createCustomNineIssuedChallenge({
      puzzleId: text(value.puzzle_id, 'puzzle_id'),
      canonicalPlayerIds: stringArray(value.canonical_player_ids, 'canonical_player_ids'),
      clueSnapshot: decodeIssuedDailyClueSnapshot(value.clue_snapshot),
      issuedAt: timestamp(value.issued_at, 'issued_at'),
    });
  });
}

function validateRecord<T>(operation: () => T): T {
  try {
    return operation();
  } catch {
    // Do not propagate raw provider data, canonical answers or future hints
    // into error messages that may be logged by a later server caller.
    throw new SupabaseCustomNineIssuedChallengeRepositoryError(
      'invalid-row',
      'Invalid or unsupported private Custom Nine challenge record.',
    );
  }
}
