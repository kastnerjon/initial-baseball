import { parseCustomLineupTitle, POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { getDailyPuzzleNumber } from './dailyPuzzleSelection';
import { requireCluesMatchFrozenOrder, validateIssuedDailyCalendarDate } from './issuedDailyPuzzleCore';
import { resolveScheduledDailyLineup, type IssuedDailyIssuanceEditorialPuzzle } from './issuedDailyIssuanceCore';
import {
  clonePermanentDailyIssuedClueSnapshot,
  type PermanentDailyIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';

/** Preserve private issuer's existing export from the portable, browser-safe validator. */
export { isOfficialDailyOccurrenceId } from './officialDailyBrowserIdentity';
import { isOfficialDailyOccurrenceId } from './officialDailyBrowserIdentity';

/** Restrict editor-defined edition keys to the canonical lowercase slug. */
export function isOfficialDailyEditionKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/** Validate all positive edition/display numbers without integer overflow. */
export function isOfficialDailyPositiveNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

export type OfficialDailyPublicationInput = {
  /** Allocated by the server once for this editorial occurrence, before any issue retries. */
  occurrenceId: string;
  editionKey: string;
  editionNumber: number;
  title?: string;
  editorial: IssuedDailyIssuanceEditorialPuzzle & { puzzleNumber: number };
};

export type OfficialDailyClueMaterializer = (
  canonicalPlayerIds: readonly string[],
  puzzleDate: string,
) => PermanentDailyIssuedClueSnapshot;

/** Private issuance payload. The clue snapshot contains answers and must stay server-side. */
export function prepareOfficialDailyPublication(
  input: OfficialDailyPublicationInput,
  materialize: OfficialDailyClueMaterializer,
) {
  const { occurrenceId, editionKey, editionNumber, editorial } = input;
  if (!isOfficialDailyOccurrenceId(occurrenceId)) {
    throw new Error('Official Daily requires a canonical UUIDv4 occurrence ID.');
  }
  if (!isOfficialDailyEditionKey(editionKey)) {
    throw new Error('Invalid official Daily edition key.');
  }
  if (!isOfficialDailyPositiveNumber(editionNumber)
    || !isOfficialDailyPositiveNumber(editorial.puzzleNumber)) {
    throw new Error('Official Daily display numbers must be positive integers.');
  }
  const title = parseCustomLineupTitle(input.title === undefined ? `Puzzle ${editionNumber}` : input.title);
  if (!title.ok) throw new Error('Invalid official Daily title.');
  validateIssuedDailyCalendarDate(editorial.puzzleDate);
  if (editorial.puzzleNumber !== getDailyPuzzleNumber(editorial.puzzleDate)) {
    throw new Error('Official Daily puzzle number must match its editorial date.');
  }
  const ordered = resolveScheduledDailyLineup(editorial, 'Official Daily');
  const clueSnapshot = clonePermanentDailyIssuedClueSnapshot(materialize(ordered, editorial.puzzleDate));
  requireCluesMatchFrozenOrder('Official Daily', ordered, clueSnapshot);
  return {
    schemaVersion: 1 as const,
    puzzleId: `daily-ed-v1-${occurrenceId}`,
    puzzleDate: editorial.puzzleDate,
    puzzleNumber: editorial.puzzleNumber,
    editionKey,
    editionNumber,
    title: title.title,
    rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
    clueSnapshot,
  };
}
