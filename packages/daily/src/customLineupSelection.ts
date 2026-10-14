import { isValidLineupLength } from './lineupLengthPolicy';

export const CUSTOM_LINEUP_SELECTION_SCHEMA_VERSION = 2 as const;

export type CustomLineupSelection = Readonly<{
  schemaVersion: typeof CUSTOM_LINEUP_SELECTION_SCHEMA_VERSION;
  canonicalPlayerIds: readonly string[];
}>;

/**
 * Portable, syntactic Custom player selection. The server must resolve IDs
 * against its authoritative canonical player catalog before issuing clues.
 * There is intentionally no recognizability/WAR restriction at this boundary.
 */
export function createCustomLineupSelection(ids: readonly string[]): CustomLineupSelection {
  if (!Array.isArray(ids) || !isValidLineupLength('future-custom-lineup', ids.length)) {
    throw new Error('Custom Lineup requires 1 through 10 players.');
  }
  validateCustomCanonicalPlayerIds(ids, 'Custom Lineup');
  return Object.freeze({
    schemaVersion: CUSTOM_LINEUP_SELECTION_SCHEMA_VERSION,
    canonicalPlayerIds: Object.freeze([...ids]),
  });
}

/** Shared ID shape/uniqueness check also used by historical Custom Nine v1. */
export function validateCustomCanonicalPlayerIds(ids: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0 || id.trim() !== id || id.length > 200) {
      throw new Error(`${label} requires valid canonical player IDs.`);
    }
    if (seen.has(id)) {
      throw new Error(`${label} cannot include the same player more than once.`);
    }
    seen.add(id);
  }
}
