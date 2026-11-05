import { parseCustomLineupTitle, POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { requireCluesMatchFrozenOrder, validateIssuedDailyCalendarDate } from './issuedDailyPuzzleCore';
import { resolveScheduledDailyLineup, type IssuedDailyIssuanceEditorialPuzzle } from './issuedDailyIssuanceCore';
import {
  clonePermanentDailyIssuedClueSnapshot,
  type PermanentDailyIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';

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
  if (typeof occurrenceId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(occurrenceId)) {
    throw new Error('Official Daily requires a canonical UUIDv4 occurrence ID.');
  }
  if (typeof editionKey !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(editionKey) || editionKey.length > 64) {
    throw new Error('Invalid official Daily edition key.');
  }
  if (!Number.isSafeInteger(editionNumber) || editionNumber < 1
    || !Number.isSafeInteger(editorial.puzzleNumber) || editorial.puzzleNumber < 1) {
    throw new Error('Official Daily display numbers must be positive integers.');
  }
  const title = parseCustomLineupTitle(input.title === undefined ? `Puzzle ${editionNumber}` : input.title);
  if (!title.ok) throw new Error('Invalid official Daily title.');
  validateIssuedDailyCalendarDate(editorial.puzzleDate);
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
