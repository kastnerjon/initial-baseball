import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocked = vi.hoisted(() => ({ catalog: vi.fn(), client: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./serverOfficialDailyEditionCatalog', async importOriginal => ({
  ...(await importOriginal<typeof import('./serverOfficialDailyEditionCatalog')>()),
  listPrivateOfficialDailyEditionsByDate: mocked.catalog,
}));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: mocked.client }));

import { isOfficialDailyEditionChooserVisible, readCurrentOfficialDailyEditionChoice } from './serverOfficialDailyEditionChoice';

const ON = {
  OFFICIAL_DAILY_EDITION_CHOICE_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_HTTP_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED: 'true',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.client.mockReturnValue({} as SupabaseClient);
  mocked.catalog.mockResolvedValue({ puzzleDate: '2026-11-06', editions: [], nextCursor: null });
});

describe('default-off official Daily edition chooser', () => {
  it('never constructs privileged clients with any missing or noncanonical gate', async () => {
    expect(isOfficialDailyEditionChooserVisible({})).toBe(false);
    for (const key of Object.keys(ON)) {
      const env = { ...ON, [key]: 'false' };
      expect(await readCurrentOfficialDailyEditionChoice({ afterEdition: 'nonsense' },
        { environment: env })).toBeNull();
    }
    expect(mocked.catalog).not.toHaveBeenCalled();
    expect(mocked.client).not.toHaveBeenCalled();
  });

  it('binds arbitrary keyset continuation to the authoritative current Pacific date', async () => {
    const now = new Date('2026-11-07T06:59:00.000Z'); // Still Nov 6 in Pacific time
    await readCurrentOfficialDailyEditionChoice({ afterEdition: '31' }, { environment: ON, now });
    expect(mocked.catalog).toHaveBeenCalledWith(expect.anything(), {
      puzzleDate: '2026-11-06', afterEditionNumber: 31, pageSize: 30,
    }, now);
    expect(mocked.client).toHaveBeenCalledTimes(1);
    const afterMidnight = new Date('2026-11-07T08:01:00.000Z');
    await readCurrentOfficialDailyEditionChoice({}, { environment: ON, now: afterMidnight });
    expect(mocked.catalog).toHaveBeenLastCalledWith(expect.anything(), {
      puzzleDate: '2026-11-07', pageSize: 30,
    }, afterMidnight);
  });

  it('rejects malformed or oversized pagination before privileged client access', async () => {
    for (const afterEdition of ['0', '-1', '03', '1.1', '123,or', '9007199254740992',
      ['1', '2'], '']) {
      await expect(readCurrentOfficialDailyEditionChoice({ afterEdition }, {
        environment: ON,
      })).rejects.toMatchObject({ kind: 'invalid' });
    }
    expect(mocked.client).not.toHaveBeenCalled();
    expect(mocked.catalog).not.toHaveBeenCalled();
  });
});
