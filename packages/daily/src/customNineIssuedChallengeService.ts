import { areIssuedDailyClueSnapshotsEqual } from './issuedDailyPuzzleCore';
import {
  cloneCustomNineIssuedChallenge,
  createCustomNineIssuedChallenge,
  validateCustomNinePuzzleId,
  type CustomNineIssuedChallenge,
  type CustomNineIssuedChallengeInput,
} from './customNineIssuedChallenge';

export type CustomNineIssuedChallengeInsertResult =
  | { status: 'inserted'; challenge: CustomNineIssuedChallenge }
  | { status: 'existing'; challenge: unknown };

export interface CustomNineIssuedChallengeRepository {
  /** First-write wins atomically; never update or upsert a challenge. */
  insertIfAbsent(challenge: CustomNineIssuedChallenge): Promise<CustomNineIssuedChallengeInsertResult>;
  /** Private server-side read: includes answer IDs and all future hints. */
  getById(puzzleId: string): Promise<unknown | null>;
}

export type CustomNineIssuedChallengeIssueResult =
  | { ok: true; status: 'created' | 'existing'; challenge: CustomNineIssuedChallenge }
  | { ok: false; error: 'immutable_conflict' };

export function createCustomNineIssuedChallengeService(repository: CustomNineIssuedChallengeRepository) {
  return {
    async issue(input: CustomNineIssuedChallengeInput): Promise<CustomNineIssuedChallengeIssueResult> {
      const requested = createCustomNineIssuedChallenge(input);
      const stored = await repository.insertIfAbsent(requested);
      if (stored.status === 'inserted') {
        const actual = cloneCustomNineIssuedChallenge(stored.challenge);
        if (!equalImmutableContent(actual, requested) || actual.issuedAt !== requested.issuedAt) {
          throw new Error('Custom Nine repository did not preserve the inserted challenge.');
        }
        return { ok: true, status: 'created', challenge: actual };
      }
      if (stored.status !== 'existing') throw new Error('Unsupported Custom Nine repository insert result.');
      // Existing records may be older/newer schemas. Only current schema
      // can be meaningfully compared; do not try to clone an unknown version.
      if (!isCurrentChallenge(stored.challenge)) return { ok: false, error: 'immutable_conflict' };
      const actual = cloneCustomNineIssuedChallenge(stored.challenge);
      return equalImmutableContent(actual, requested)
        ? { ok: true, status: 'existing', challenge: actual }
        : { ok: false, error: 'immutable_conflict' };
    },
    async getById(puzzleId: string): Promise<CustomNineIssuedChallenge | null> {
      validateCustomNinePuzzleId(puzzleId);
      const stored = await repository.getById(puzzleId);
      if (stored === null) return null;
      if (!isCurrentChallenge(stored)) throw new Error('Unsupported Custom Nine stored challenge version.');
      const challenge = cloneCustomNineIssuedChallenge(stored);
      if (challenge.puzzleId !== puzzleId) {
        throw new Error('Custom Nine repository returned the wrong challenge.');
      }
      return challenge;
    },
  };
}

function isCurrentChallenge(value: unknown): value is CustomNineIssuedChallenge {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as { schemaVersion?: unknown; rulesetVersion?: unknown };
  return record.schemaVersion === 1 && record.rulesetVersion === 'points-v4';
}

function equalImmutableContent(left: CustomNineIssuedChallenge, right: CustomNineIssuedChallenge): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.rulesetVersion === right.rulesetVersion
    && left.puzzleId === right.puzzleId
    && left.canonicalPlayerIds.length === right.canonicalPlayerIds.length
    && left.canonicalPlayerIds.every((id, index) => id === right.canonicalPlayerIds[index])
    && areIssuedDailyClueSnapshotsEqual(left.clueSnapshot, right.clueSnapshot);
}
