import type { PermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';

/** Shared, portable invariants of immutable Custom v1 and v2 challenges. */
export function normalizeCustomIssuedAt(issuedAt: string): string {
  if (typeof issuedAt !== 'string' || issuedAt.length < 20 || issuedAt.length > 40) {
    throw new Error('Invalid Custom Nine issue timestamp.');
  }
  const timestamp = Date.parse(issuedAt);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid Custom Nine issue timestamp.');
  return new Date(timestamp).toISOString();
}

/** Call only on a defensive clone, never on an input owned by a caller. */
export function freezeCustomClueSnapshot(snapshot: PermanentDailyIssuedClueSnapshot): PermanentDailyIssuedClueSnapshot {
  for (const hint of snapshot.hintLayout) Object.freeze(hint);
  for (const pitch of snapshot.pitches) {
    Object.freeze(pitch.hintValues);
    Object.freeze(pitch);
  }
  Object.freeze(snapshot.hintLayout);
  Object.freeze(snapshot.pitches);
  return Object.freeze(snapshot);
}
