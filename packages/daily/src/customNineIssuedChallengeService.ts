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
  | { status: 'existing'; challenge: CustomNineIssuedChallenge };

export interface CustomNineIssuedChallengeRepository {
  /** First-write wins atomically; never update or upsert a challenge. */
  insertIfAbsent(challenge: CustomNineIssuedChallenge): Promise<CustomNineIssuedChallengeInsertResult>;
  /** Private server-side read: includes answer IDs and all future hints. */
  getById(puzzleId: string): Promise<CustomNineIssuedChallenge | null>;
}

export type CustomNineIssuedChallengeIssueResult =
  | { ok: true; status: 'created' | 'existing'; challenge: CustomNineIssuedChallenge }
  | { ok: false; error: 'immutable_conflict' };

export function createCustomNineIssuedChallengeService(repository: CustomNineIssuedChallengeRepository) {
  return {
    async issue(input: CustomNineIssuedChallengeInput): Promise<CustomNineIssuedChallengeIssueResult> {
      const requested = createCustomNineIssuedChallenge(input);
      const stored = await repository.insertIfAbsent(requested);
      const actual = cloneCustomNineIssuedChallenge(stored.challenge);
      const same = equalImmutableContent(actual, requested);
      if (stored.status === 'inserted') {
        if (!same || actual.issuedAt !== requested.issuedAt) {
          throw new Error('Custom Nine repository did not preserve the inserted challenge.');
        }
        return { ok: true, status: 'created', challenge: actual };
      }
      if (stored.status !== 'existing') throw new Error('Unsupported Custom Nine repository insert result.');
      return same
        ? { ok: true, status: 'existing', challenge: actual }
        : { ok: false, error: 'immutable_conflict' };
    },
    async getById(puzzleId: string): Promise<CustomNineIssuedChallenge | null> {
      validateCustomNinePuzzleId(puzzleId);
      const stored = await repository.getById(puzzleId);
      if (stored === null) return null;
      const challenge = cloneCustomNineIssuedChallenge(stored);
      if (challenge.puzzleId !== puzzleId) {
        throw new Error('Custom Nine repository returned the wrong challenge.');
      }
      return challenge;
    },
  };
}

function equalImmutableContent(left: CustomNineIssuedChallenge, right: CustomNineIssuedChallenge): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.rulesetVersion === right.rulesetVersion
    && left.puzzleId === right.puzzleId
    && left.canonicalPlayerIds.length === right.canonicalPlayerIds.length
    && left.canonicalPlayerIds.every((id, index) => id === right.canonicalPlayerIds[index])
    && areIssuedDailyClueSnapshotsEqual(left.clueSnapshot, right.clueSnapshot);
}
