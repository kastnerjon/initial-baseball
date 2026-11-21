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

// Match the immutable edition and competitive-proof UUID v4 contracts.
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OFFICIAL_ID_PATTERN = /^daily-ed-v1-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const milliseconds = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(milliseconds)
    && new Date(milliseconds).toISOString().slice(0, 10) === value;
}

/**
 * Source-only reservation boundary, not competitive admission. Its caller must
 * establish a server-issued random HttpOnly browser credential and trusted
 * released-publication/date eligibility before calling. Credential length
 * alone does not prove entropy or identify a unique human/browser; two initial
 * cookies can still race. The store must enforce durable composite uniqueness
 * and unique attempt IDs. No public route uses this candidate.
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
      if (typeof request.puzzleId !== 'string'
        || !OFFICIAL_ID_PATTERN.test(request.puzzleId)
        || typeof request.puzzleDate !== 'string'
        || !isCalendarDate(request.puzzleDate)
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
      if (!UUID_V4_PATTERN.test(stored.attemptId)
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
