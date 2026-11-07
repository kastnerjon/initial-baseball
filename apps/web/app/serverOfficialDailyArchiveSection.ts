import 'server-only';
import {
  listPrivateOfficialDailyArchivePage, OfficialDailyCatalogError,
} from './serverOfficialDailyEditionCatalog';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { validateIssuedDailyCalendarDate } from '@initial-baseball/daily';
import { getPacificDailyDateString } from './getPacificDailyDateString';

export type OfficialDailyArchivePage = Awaited<ReturnType<typeof listPrivateOfficialDailyArchivePage>>;
type ArchiveQuery = Record<string, string | string[] | undefined>;
type Environment = Record<string, string | undefined>;
const REQUIRED_FLAGS = [
  'OFFICIAL_DAILY_EDITION_ARCHIVE_ENABLED',
  'OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED',
  'OFFICIAL_DAILY_EDITION_HTTP_ENABLED',
  'OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED',
] as const;

export function isOfficialDailyArchiveVisible(env: Environment = process.env): boolean {
  return REQUIRED_FLAGS.every(flag => env[flag] === 'true');
}

/** Public cursor decoding is intentionally independent of private SQL construction. */
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
  try {
    validateIssuedDailyCalendarDate(query.afterDate);
  } catch {
    throw new OfficialDailyCatalogError('invalid');
  }
  const editionNumber = Number(query.afterEdition);
  if (!Number.isSafeInteger(editionNumber)) throw new OfficialDailyCatalogError('invalid');
  return { after: { puzzleDate: query.afterDate, editionNumber } };
}

/** No DB construction or credential access with any gate OFF. */
export async function readPrivateOfficialDailyArchive(
  query: ArchiveQuery,
  options: {
    environment?: Environment;
    createClient?: typeof createServerSupabaseClient;
    now?: Date;
  } = {},
): Promise<OfficialDailyArchivePage | null> {
  if (!isOfficialDailyArchiveVisible(options.environment)) return null;
  const cursor = parseOfficialDailyArchiveCursor(query);
  const now = options.now ?? new Date();
  // Invalid/current/future cursors must not even construct a privileged client.
  if (cursor.after !== undefined && cursor.after.puzzleDate >= getPacificDailyDateString(now)) {
    throw new OfficialDailyCatalogError('invalid');
  }
  return listPrivateOfficialDailyArchivePage(
    (options.createClient ?? createServerSupabaseClient)(),
    { ...cursor, pageSize: 30 },
    now,
  );
}
