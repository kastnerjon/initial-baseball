import 'server-only';
import {
  listPrivateOfficialDailyEditionsByDate, OfficialDailyCatalogError,
} from './serverOfficialDailyEditionCatalog';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { getPacificDailyDateString } from './getPacificDailyDateString';

export type OfficialDailyEditionChoicePage = Awaited<ReturnType<typeof listPrivateOfficialDailyEditionsByDate>>;
type Environment = Record<string, string | undefined>;
const REQUIRED_FLAGS = [
  'OFFICIAL_DAILY_EDITION_CHOICE_ENABLED',
  'OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED',
  'OFFICIAL_DAILY_EDITION_HTTP_ENABLED',
  'OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED',
] as const;

export function isOfficialDailyEditionChooserVisible(env: Environment = process.env): boolean {
  return REQUIRED_FLAGS.every(flag => env[flag] === 'true');
}

/** Only a positive keyset cursor is accepted; URL tracking keys are not authority. */
function parseCursor(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,14}$/.test(value)) {
    throw new OfficialDailyCatalogError('invalid');
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new OfficialDailyCatalogError('invalid');
  return n;
}

/** Server-only selection: flags before service access, cursor before DB client, Pacific today only. */
export async function readCurrentOfficialDailyEditionChoice(
  query: Readonly<{ afterEdition?: string | string[] | undefined }>,
  options: {
    environment?: Environment;
    now?: Date;
    createClient?: typeof createServerSupabaseClient;
  } = {},
): Promise<OfficialDailyEditionChoicePage | null> {
  if (!isOfficialDailyEditionChooserVisible(options.environment)) return null;
  const after = parseCursor(query?.afterEdition);
  const now = options.now ?? new Date();
  return listPrivateOfficialDailyEditionsByDate(
    (options.createClient ?? createServerSupabaseClient)(),
    {
      puzzleDate: getPacificDailyDateString(now),
      ...(after === undefined ? {} : { afterEditionNumber: after }),
      pageSize: 30,
    },
    now,
  );
}
