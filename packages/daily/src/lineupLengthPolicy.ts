import { DAILY_AT_BAT_COUNT } from './dailyConstants';

/**
 * Portable length policies, not issued-puzzle schema versions.
 *
 * Existing nine-player puzzles retain their original length regardless of
 * which lineup size is used for future issuance. Future profiles must
 * be selected by explicit new issuance/version paths; this module alone
 * does not authorize new Daily or Custom records.
 */
export const DAILY_FIVE_AT_BAT_COUNT = 5;
export const CUSTOM_LINEUP_MIN_AT_BATS = 1;
export const CUSTOM_LINEUP_MAX_AT_BATS = 10;

export type LineupLengthPolicy =
  | 'legacy-daily-nine'
  | 'classic-inning'
  | 'custom-nine-v1'
  | 'future-daily-five'
  | 'future-custom-lineup';

/** Validates length only; canonical identity, ordering and clue checks remain separate. */
export function isValidLineupLength(policy: LineupLengthPolicy, count: number): boolean {
  if (!Number.isSafeInteger(count)) return false;

  switch (policy) {
    case 'legacy-daily-nine':
    case 'classic-inning':
    case 'custom-nine-v1':
      return count === DAILY_AT_BAT_COUNT;
    case 'future-daily-five':
      return count === DAILY_FIVE_AT_BAT_COUNT;
    case 'future-custom-lineup':
      return count >= CUSTOM_LINEUP_MIN_AT_BATS && count <= CUSTOM_LINEUP_MAX_AT_BATS;
    default:
      return false;
  }
}
