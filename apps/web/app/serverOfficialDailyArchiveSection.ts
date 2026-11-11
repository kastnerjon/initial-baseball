import 'server-only';
import { validateIssuedDailyCalendarDate } from '@initial-baseball/daily';
import { OfficialDailyCatalogError } from './serverOfficialDailyEditionCatalog';

type ArchiveQuery = Record<string, string | string[] | undefined>;
type Environment = Record<string, string | undefined>;
const REQUIRED_FLAGS = [
  'OFFICIAL_DAILY_EDITION_ARCHIVE_ENABLED',
  'OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED',
  'OFFICIAL_DAILY_EDITION_HTTP_ENABLED',
  'OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED',
] as const;

/** Unified Archive and historical beta remain separated unless all flags are exact true. */
export function isOfficialDailyArchiveVisible(env: Environment = process.env): boolean {
  return REQUIRED_FLAGS.every(flag => env[flag] === 'true');
}

/** Strict public cursor validation before constructing the service-only database client. */
export function parseOfficialDailyArchiveCursor(query: ArchiveQuery): {
  after?: { puzzleDate: string; editionNumber: number };
} {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new OfficialDailyCatalogError('invalid');
  }
  const keys = Object.keys(query);
  if (keys.length === 0) return {};
  if (keys.length !== 2 || !keys.includes('afterDate') || !keys.includes('afterEdition')
      || typeof query.afterDate !== 'string' || typeof query.afterEdition !== 'string'
      || !/^[1-9][0-9]{0,14}$/.test(query.afterEdition)) {
    throw new OfficialDailyCatalogError('invalid');
  }
  try { validateIssuedDailyCalendarDate(query.afterDate); }
  catch { throw new OfficialDailyCatalogError('invalid'); }
  const editionNumber = Number(query.afterEdition);
  if (!Number.isSafeInteger(editionNumber)) throw new OfficialDailyCatalogError('invalid');
  return { after: { puzzleDate: query.afterDate, editionNumber } };
}
