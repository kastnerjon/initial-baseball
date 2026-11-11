import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import {
  isOfficialDailyArchiveVisible, parseOfficialDailyArchiveCursor,
} from './serverOfficialDailyArchiveSection';
import { listPrivateLegacyPrimaryDailyPublications } from './serverLegacyPrimaryDailyArchiveCatalog';
import { listPrivateOfficialDailyArchivePage } from './serverOfficialDailyEditionCatalog';
import { createServerSupabaseClient } from './serverSupabaseClient';
import {
  mergePrivateOfficialDailyArchive, UnifiedDailyArchiveError,
  type UnifiedArchivePage,
} from './unifiedOfficialDailyArchiveMerge';

type ArchiveQuery = Record<string, string | string[] | undefined>;
type Environment = Record<string, string | undefined>;

/**
 * Joins published legacy primaries and frozen secondary metadata behind the
 * EXISTING default-OFF Archive gates. This is never gameplay/result authority.
 * Check cursor and Pacific clock before constructing a service-role client.
 */
export async function readPrivateUnifiedOfficialDailyArchive(
  query: ArchiveQuery,
  options: {
    environment?: Environment;
    createClient?: () => SupabaseClient;
    now?: Date;
  } = {},
): Promise<UnifiedArchivePage | null> {
  if (!isOfficialDailyArchiveVisible(options.environment)) return null;
  const cursor = parseOfficialDailyArchiveCursor(query);
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime()) || (cursor.after !== undefined
    && cursor.after.puzzleDate >= getPacificDailyDateString(now))) {
    throw new UnifiedDailyArchiveError('invalid');
  }
  const client = (options.createClient ?? createServerSupabaseClient)();
  return mergePrivateOfficialDailyArchive({
    primary: (q, clock) => listPrivateLegacyPrimaryDailyPublications(client, q, clock),
    secondary: (q, clock) => listPrivateOfficialDailyArchivePage(client, q, clock),
  }, { ...cursor, pageSize: 30 }, now);
}
