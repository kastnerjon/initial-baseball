import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocked = vi.hoisted(() => ({ primary: vi.fn(), secondary: vi.fn(), client: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: mocked.client }));
vi.mock('./serverLegacyPrimaryDailyArchiveCatalog', () => ({
  listPrivateLegacyPrimaryDailyPublications: mocked.primary,
}));
vi.mock('./serverOfficialDailyEditionCatalog', async importOriginal => ({
  ...(await importOriginal<typeof import('./serverOfficialDailyEditionCatalog')>()),
  listPrivateOfficialDailyArchivePage: mocked.secondary,
}));

import { readPrivateUnifiedOfficialDailyArchive } from './serverUnifiedOfficialDailyArchiveSection';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const ON = {
  OFFICIAL_DAILY_EDITION_ARCHIVE_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_HTTP_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED: 'true',
};
const ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';

beforeEach(() => {
  vi.resetAllMocks();
  mocked.client.mockReturnValue({} as SupabaseClient);
  mocked.primary.mockResolvedValue({
    publications: [{ editorialRecordId: 'daily-2026-11-05-v1',
      puzzleDate: '2026-11-05', puzzleNumber: 193,
      publishedAt: '2026-11-06T08:00:02.356Z' }], nextCursor: null,
  });
  mocked.secondary.mockResolvedValue({
    dates: [{ puzzleDate: '2026-11-05', editions: [{
      puzzleId: ID, puzzleDate: '2026-11-05', puzzleNumber: 193,
      editionNumber: 2, title: 'Modern',
    }] }], nextCursor: null,
  });
});

describe('private unified official Daily Archive source composition', () => {
  it('touches neither privileged client nor catalog with any gate OFF', async () => {
    expect(await readPrivateUnifiedOfficialDailyArchive({}, { environment: {} })).toBeNull();
    for (const flag of Object.keys(ON)) {
      const env = { ...ON, [flag]: 'TRUE' };
      expect(await readPrivateUnifiedOfficialDailyArchive(
        { afterDate: 'invalid', afterEdition: '0' }, { environment: env },
      )).toBeNull();
    }
    expect(mocked.client).not.toHaveBeenCalled();
    expect(mocked.primary).not.toHaveBeenCalled();
    expect(mocked.secondary).not.toHaveBeenCalled();
  });

  it('shares exactly one service client and one Pacific clock for both catalog sources', async () => {
    const page = await readPrivateUnifiedOfficialDailyArchive({}, { environment: ON, now: NOW });
    expect(page?.dates[0]?.editions.map(e => e.editionNumber)).toEqual([1, 2]);
    expect(page?.dates[0]?.editions[0]).toMatchObject({
      kind: 'legacy-primary', puzzleId: null, title: 'Puzzle 1',
    });
    expect(page?.dates[0]?.editions[1]).toMatchObject({
      kind: 'official-secondary', puzzleId: ID, title: 'Modern',
    });
    expect(mocked.client).toHaveBeenCalledTimes(1);
    const client = mocked.client.mock.results[0]!.value;
    expect(mocked.primary).toHaveBeenCalledWith(client, { pageSize: 31 }, NOW);
    expect(mocked.secondary).toHaveBeenCalledWith(client, { pageSize: 31 }, NOW);
    expect(JSON.stringify(page)).not.toContain('editorialRecordId');
    expect(JSON.stringify(page)).not.toContain('selections');
    expect(JSON.stringify(page)).not.toContain('clue_snapshot');
  });

  it('binds date/edition cursor to both sources, continuing within the same date', async () => {
    mocked.primary.mockResolvedValue({ publications: [], nextCursor: null });
    const page = await readPrivateUnifiedOfficialDailyArchive({
      afterDate: '2026-11-05', afterEdition: '1',
    }, { environment: ON, now: NOW });
    expect(page?.dates[0]?.editions.map(e => e.editionNumber)).toEqual([2]);
    expect(mocked.primary).toHaveBeenCalledWith(expect.anything(), {
      afterDate: '2026-11-05', pageSize: 31,
    }, NOW);
    expect(mocked.secondary).toHaveBeenCalledWith(expect.anything(), {
      after: { puzzleDate: '2026-11-05', editionNumber: 1 }, pageSize: 31,
    }, NOW);
  });

  it('rejects malformed/current/future cursors before privileged client access', async () => {
    for (const bad of [
      { afterDate: '2026-11-05' },
      { afterDate: '2026-11-05', afterEdition: '0' },
      { afterDate: '2026-11-05', afterEdition: '02' },
      { afterDate: ['2026-11-05'], afterEdition: '2' },
      { afterDate: '2026-11-07', afterEdition: '1' },
      { afterDate: '2026-11-08', afterEdition: '1' },
    ]) {
      await expect(readPrivateUnifiedOfficialDailyArchive(
        bad, { environment: ON, now: NOW },
      )).rejects.toMatchObject({ kind: 'invalid' });
    }
    expect(mocked.client).not.toHaveBeenCalled();
  });

  it('redacts either provider fault without returning a partial Archive', async () => {
    mocked.secondary.mockRejectedValueOnce(new Error('SECONDARY_SERVICE_ROLE_SECRET'));
    await expect(readPrivateUnifiedOfficialDailyArchive(
      {}, { environment: ON, now: NOW },
    )).rejects.toMatchObject({ kind: 'unavailable' });
    mocked.primary.mockRejectedValueOnce(new Error('PRIMARY_PRIVATE_PLAYER_ID'));
    await expect(readPrivateUnifiedOfficialDailyArchive(
      {}, { environment: ON, now: NOW },
    )).rejects.toMatchObject({ kind: 'unavailable' });
    expect(mocked.client).toHaveBeenCalledTimes(2);
  });
});
