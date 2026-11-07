import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocked = vi.hoisted(() => ({ catalog: vi.fn(), client: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./serverOfficialDailyEditionCatalog', async importOriginal => ({
  ...(await importOriginal<typeof import('./serverOfficialDailyEditionCatalog')>()),
  listPrivateOfficialDailyArchivePage: mocked.catalog,
}));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: mocked.client }));

import {
  isOfficialDailyArchiveVisible, parseOfficialDailyArchiveCursor, readPrivateOfficialDailyArchive,
} from './serverOfficialDailyArchiveSection';

const ENABLED = {
  OFFICIAL_DAILY_EDITION_ARCHIVE_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_HTTP_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED: 'true',
};
const CURSOR = { puzzleDate: '2026-11-05', editionNumber: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  mocked.client.mockReturnValue({} as SupabaseClient);
  mocked.catalog.mockResolvedValue({ dates: [], nextCursor: null });
});

describe('default-off official Daily Archive section', () => {
  it('does no service-role I/O with any server gate absent or noncanonical', async () => {
    expect(isOfficialDailyArchiveVisible({})).toBe(false);
    for (const flag of Object.keys(ENABLED)) {
      const env = { ...ENABLED, [flag]: 'TRUE' };
      expect(isOfficialDailyArchiveVisible(env)).toBe(false);
      expect(await readPrivateOfficialDailyArchive(
        { afterDate: 'invalid', afterEdition: 'oops' }, { environment: env },
      )).toBeNull();
    }
    expect(mocked.client).not.toHaveBeenCalled();
    expect(mocked.catalog).not.toHaveBeenCalled();
  });

  it('passes one strictly decoded cursor to the metadata-only reader', async () => {
    const now = new Date('2026-11-07T12:00:00Z');
    await readPrivateOfficialDailyArchive(
      { afterDate: CURSOR.puzzleDate, afterEdition: '2' },
      { environment: ENABLED, now },
    );
    expect(mocked.client).toHaveBeenCalledTimes(1);
    expect(mocked.catalog).toHaveBeenCalledWith(
      expect.anything(), { after: CURSOR, pageSize: 30 }, now,
    );
    await readPrivateOfficialDailyArchive({}, { environment: ENABLED, now });
    expect(mocked.catalog).toHaveBeenLastCalledWith(
      expect.anything(), { pageSize: 30 }, now,
    );
  });

  it('rejects malicious or malformed cursors before service-role access', async () => {
    const invalid: Array<Record<string, string | string[] | undefined>> = [
      { afterDate: '2026-11-05' },
      { afterEdition: '2' },
      { afterDate: '2026-11-05', afterEdition: '02' },
      { afterDate: '2026-11-05', afterEdition: '0' },
      { afterDate: '2026-11-05', afterEdition: '1.5' },
      { afterDate: '2026-11-05', afterEdition: '9999999999999999' },
      { afterDate: '2026-11-05', afterEdition: '2', debug: '1' },
      { afterDate: '2026-11-05', afterEdition: ['1', '2'] },
      { afterDate: '2026-02-30', afterEdition: '2' },
      { afterDate: '2026-11-05,or', afterEdition: '2' },
    ];
    for (const query of invalid) {
      expect(() => parseOfficialDailyArchiveCursor(query)).toThrow();
      await expect(readPrivateOfficialDailyArchive(query, { environment: ENABLED }))
        .rejects.toMatchObject({ kind: 'invalid' });
    }
    expect(mocked.client).not.toHaveBeenCalled();
    expect(mocked.catalog).not.toHaveBeenCalled();
  });
});
