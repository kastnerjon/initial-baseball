import 'server-only';
import {
  createEditorialDailyPuzzleId,
  getDailyPuzzleNumber,
  validateDailyEditorialSelectionsForContract,
  validateIssuedDailyCalendarDate,
  type DailyPuzzleEditorialRecord,
} from '@initial-baseball/daily';
import type { LegacyPrimaryPublication } from './serverLegacyPrimaryDailyArchiveCatalog';
import { getPacificDailyDateString } from './getPacificDailyDateString';

export type VerifiedLegacyPrimaryGameIdentity = Readonly<{
  puzzleDate: string;
  puzzleNumber: number;
  puzzleId: string;
}>;

export class LegacyPrimaryIdentityVerificationError extends Error {
  constructor() {
    super('Historical primary Daily identity could not be verified.');
    this.name = 'LegacyPrimaryIdentityVerificationError';
  }
}

const invalid = (): never => { throw new LegacyPrimaryIdentityVerificationError(); };

/**
 * Resolves only the CURRENT authorized published roster-derived identity.
 * This is a private read-only verification, never historical replay permission.
 * Legacy fallback/other accepted IDs remain separate in their original score
 * populations, including multiple accepted IDs on the same historical day.
 */
export async function verifyPublishedLegacyPrimaryGameIdentity(
  publication: LegacyPrimaryPublication,
  readEditorial: (date: string) => Promise<DailyPuzzleEditorialRecord | null>,
  now: Date = new Date(),
): Promise<VerifiedLegacyPrimaryGameIdentity> {
  if (!Number.isFinite(now.getTime()) || !publication
    || typeof publication !== 'object' || Array.isArray(publication)
    || typeof publication.puzzleDate !== 'string') invalid();
  try { validateIssuedDailyCalendarDate(publication.puzzleDate); }
  catch { invalid(); }
  if (publication.puzzleDate >= getPacificDailyDateString(now)
    || !Number.isSafeInteger(publication.puzzleNumber)
    || publication.puzzleNumber !== getDailyPuzzleNumber(publication.puzzleDate)
    || publication.editorialRecordId !== 'daily-' + publication.puzzleDate + '-v1'
    || typeof publication.publishedAt !== 'string') invalid();
  const publishedAt = Date.parse(publication.publishedAt);
  if (!Number.isFinite(publishedAt) || publishedAt > now.getTime()) invalid();

  try {
    const record = await readEditorial(publication.puzzleDate);
    if (record === null || record.status !== 'published' || record.version !== 1
      || record.id !== publication.editorialRecordId
      || record.puzzleDate !== publication.puzzleDate
      || record.puzzleNumber !== publication.puzzleNumber
      || record.publishedAt === null
      || Date.parse(record.publishedAt) !== publishedAt) invalid();
    validateDailyEditorialSelectionsForContract(record.selections, 1);
    const slots = [...record.selections].sort((a, b) => a.slot - b.slot);
    if (slots.length !== 9 || slots.some((slot, index) => slot.slot !== index + 1)) invalid();
    return {
      puzzleDate: publication.puzzleDate,
      puzzleNumber: publication.puzzleNumber,
      puzzleId: createEditorialDailyPuzzleId(
        publication.puzzleDate, slots.map(slot => slot.canonicalPlayerId),
      ),
    };
  } catch { invalid(); }
}
