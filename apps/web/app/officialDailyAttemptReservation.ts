import 'server-only';
import { createHash, randomUUID } from 'node:crypto';

export type OfficialDailyAttemptReservation = {
  attemptId: string;
  puzzleId: string;
  puzzleDate: string;
  rulesetVersion: 'points-v4';
  browserKeyDigest: string;
  startedAt: string;
};

export type OfficialDailyAttemptReservationStore = {
  /** Must atomically insert or return the existing row for the exact composite key. */
  insertOrRead: (reservation: OfficialDailyAttemptReservation) => Promise<OfficialDailyAttemptReservation>;
};

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Server-side first-start reservation adapter. It does not establish a unique
 * person or prevent cookie loss; the store must enforce a composite unique key.
 * No public route uses this source-only candidate.
 */
export function createOfficialDailyAttemptReservationService(input: {
  store: OfficialDailyAttemptReservationStore;
  now: () => Date;
  createAttemptId?: () => string;
}) {
  return {
    async reserve(request: {
      puzzleId: string;
      puzzleDate: string;
      rulesetVersion: 'points-v4';
      browserKey: string;
    }): Promise<OfficialDailyAttemptReservation> {
      if (!/^daily-ed-v1-[0-9a-f-]{36}$/i.test(request.puzzleId)
        || !/^\d{4}-\d{2}-\d{2}$/.test(request.puzzleDate)
        || request.rulesetVersion !== 'points-v4'
        || typeof request.browserKey !== 'string'
        || request.browserKey.length < 32
        || request.browserKey.length > 256) {
        throw new Error('Invalid official Daily attempt reservation.');
      }
      const browserKeyDigest = createHash('sha256').update(request.browserKey, 'utf8').digest('hex');
      const candidate: OfficialDailyAttemptReservation = {
        attemptId: input.createAttemptId?.() ?? randomUUID(),
        puzzleId: request.puzzleId,
        puzzleDate: request.puzzleDate,
        rulesetVersion: request.rulesetVersion,
        browserKeyDigest,
        startedAt: input.now().toISOString(),
      };
      const stored = await input.store.insertOrRead(candidate);
      if (!UUID_PATTERN.test(stored.attemptId)
        || !DIGEST_PATTERN.test(stored.browserKeyDigest)
        || stored.puzzleId !== candidate.puzzleId
        || stored.puzzleDate !== candidate.puzzleDate
        || stored.rulesetVersion !== candidate.rulesetVersion
        || stored.browserKeyDigest !== candidate.browserKeyDigest
        || !Number.isFinite(Date.parse(stored.startedAt))) {
        throw new Error('Official Daily attempt reservation mismatch.');
      }
      return stored;
    },
  };
}
