import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocked = vi.hoisted(() => ({ catalog: vi.fn(), client: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./serverOfficialDailyEditionCatalog', async importOriginal => ({
  ...(await importOriginal<typeof import('./serverOfficialDailyEditionCatalog')>()),
  listPrivateOfficialDailyEditionsByDate: mocked.catalog,
}));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: mocked.client }));

import {
  isOfficialDailyEditionChooserVisible, isOfficialDailyEditionPracticeVisible,
  isOfficialDailyEditionCompetitivePreviewVisible, isOfficialDailyEditionCompetitiveVisible,
  readCurrentOfficialDailyEditionChoice,
} from './serverOfficialDailyEditionChoice';
import { isOfficialDailyArchiveVisible } from './serverOfficialDailyArchiveSection';

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
  it('requires destination practice gates independently of the chooser switch', () => {
    expect(isOfficialDailyEditionPracticeVisible({})).toBe(false);
    expect(isOfficialDailyEditionPracticeVisible(ON)).toBe(true);
    expect(isOfficialDailyEditionPracticeVisible({
      ...ON, OFFICIAL_DAILY_EDITION_CHOICE_ENABLED: 'false',
    })).toBe(true);
    expect(isOfficialDailyEditionChooserVisible({
      ...ON, OFFICIAL_DAILY_EDITION_CHOICE_ENABLED: 'false',
    })).toBe(false);
    for (const flag of ['OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED',
      'OFFICIAL_DAILY_EDITION_HTTP_ENABLED',
      'OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED']) {
      expect(isOfficialDailyEditionPracticeVisible({ ...ON, [flag]: 'false' })).toBe(false);
    }
  });


  it('permits scored UI only with every preview gate and destination gate', () => {
    const env = {
      ...ON, VERCEL_ENV: 'preview',
      OFFICIAL_DAILY_COMPETITIVE_UI_QA: 'true',
      OFFICIAL_DAILY_EDITION_COMPETITIVE_HTTP_ENABLED: 'true',
    };
    expect(isOfficialDailyEditionCompetitivePreviewVisible(env)).toBe(true);
    expect(isOfficialDailyEditionCompetitivePreviewVisible({ ...env, VERCEL_ENV: 'production' })).toBe(false);
    for (const flag of [
      'OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED',
      'OFFICIAL_DAILY_EDITION_HTTP_ENABLED',
      'OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED',
      'OFFICIAL_DAILY_COMPETITIVE_UI_QA',
      'OFFICIAL_DAILY_EDITION_COMPETITIVE_HTTP_ENABLED',
    ]) {
      expect(isOfficialDailyEditionCompetitivePreviewVisible({ ...env, [flag]: 'false' })).toBe(false);
    }
    expect(isOfficialDailyEditionCompetitivePreviewVisible({})).toBe(false);
  });

  it('uses distinct explicit Preview and production scoring gates, fail-closed across UI and API', () => {
    const qa = {
      ...ON, VERCEL_ENV: 'preview', OFFICIAL_DAILY_COMPETITIVE_UI_QA: 'true',
      OFFICIAL_DAILY_EDITION_COMPETITIVE_HTTP_ENABLED: 'true',
    };
    const prod = {
      ...ON, VERCEL_ENV: 'production', OFFICIAL_DAILY_COMPETITIVE_PRODUCTION_ENABLED: 'true',
      OFFICIAL_DAILY_EDITION_COMPETITIVE_HTTP_ENABLED: 'true',
    };
    expect(isOfficialDailyEditionCompetitiveVisible({})).toBe(false);
    expect(isOfficialDailyEditionCompetitiveVisible(qa)).toBe(true);
    expect(isOfficialDailyEditionCompetitiveVisible(prod)).toBe(true);
    expect(isOfficialDailyEditionCompetitivePreviewVisible(prod)).toBe(false);
    expect(isOfficialDailyEditionCompetitiveVisible({ ...qa, VERCEL_ENV: 'production' })).toBe(false);
    expect(isOfficialDailyEditionCompetitiveVisible({ ...prod, VERCEL_ENV: 'preview' })).toBe(false);
    for (const env of [qa, prod]) {
      for (const flag of [
        'OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED',
        'OFFICIAL_DAILY_EDITION_HTTP_ENABLED',
        'OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED',
        'OFFICIAL_DAILY_EDITION_COMPETITIVE_HTTP_ENABLED',
      ]) {
        expect(isOfficialDailyEditionCompetitiveVisible({ ...env, [flag]: 'false' })).toBe(false);
        expect(isOfficialDailyEditionCompetitiveVisible({ ...env, [flag]: 'TRUE' })).toBe(false);
      }
      expect(isOfficialDailyEditionCompetitiveVisible({ ...env, VERCEL_ENV: 'development' })).toBe(false);
      expect(isOfficialDailyEditionCompetitiveVisible({ ...env, VERCEL_ENV: undefined })).toBe(false);
    }
    expect(isOfficialDailyEditionCompetitiveVisible({
      ...prod, OFFICIAL_DAILY_COMPETITIVE_PRODUCTION_ENABLED: 'false',
    })).toBe(false);
    expect(isOfficialDailyEditionCompetitiveVisible({
      ...qa, OFFICIAL_DAILY_COMPETITIVE_UI_QA: 'false',
    })).toBe(false);
    expect(isOfficialDailyEditionCompetitiveVisible({
      ...prod, OFFICIAL_DAILY_COMPETITIVE_UI_QA: 'true',
      OFFICIAL_DAILY_COMPETITIVE_PRODUCTION_ENABLED: 'false',
    })).toBe(false);
  });

  it('matches all 32 real release-flag combinations, including chooser ON and Archive OFF', () => {
    const flags = [
      'OFFICIAL_DAILY_EDITION_CHOICE_ENABLED',
      'OFFICIAL_DAILY_EDITION_ARCHIVE_ENABLED',
      'OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED',
      'OFFICIAL_DAILY_EDITION_HTTP_ENABLED',
      'OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED',
    ] as const;
    for (let mask = 0; mask < 32; mask += 1) {
      const env: Record<string, string> = {};
      flags.forEach((flag, index) => { env[flag] = (mask & (1 << index)) ? 'true' : 'false'; });
      const practiceOn = flags.slice(2).every(flag => env[flag] === 'true');
      expect(isOfficialDailyEditionPracticeVisible(env)).toBe(practiceOn);
      expect(isOfficialDailyEditionChooserVisible(env)).toBe(practiceOn && env[flags[0]] === 'true');
      expect(isOfficialDailyArchiveVisible(env)).toBe(practiceOn && env[flags[1]] === 'true');
    }
    expect(isOfficialDailyEditionChooserVisible({ ...ON, OFFICIAL_DAILY_EDITION_ARCHIVE_ENABLED: 'false' })).toBe(true);
    expect(isOfficialDailyArchiveVisible({ ...ON, OFFICIAL_DAILY_EDITION_ARCHIVE_ENABLED: 'false' })).toBe(false);
  });

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
    await readCurrentOfficialDailyEditionChoice({
      afterEdition: '31', cursorDate: '2026-11-06',
    }, { environment: ON, now });
    expect(mocked.catalog).toHaveBeenCalledWith(expect.anything(), {
      puzzleDate: '2026-11-06', afterEditionNumber: 31, pageSize: 30,
    }, now);
    expect(mocked.client).toHaveBeenCalledTimes(1);
    const afterMidnight = new Date('2026-11-07T08:01:00.000Z');
    await expect(readCurrentOfficialDailyEditionChoice({
      afterEdition: '31', cursorDate: '2026-11-06',
    }, { environment: ON, now: afterMidnight })).rejects.toMatchObject({ kind: 'invalid' });
    expect(mocked.catalog).toHaveBeenCalledTimes(1);
    expect(mocked.client).toHaveBeenCalledTimes(1);
    await readCurrentOfficialDailyEditionChoice({}, { environment: ON, now: afterMidnight });
    expect(mocked.catalog).toHaveBeenLastCalledWith(expect.anything(), {
      puzzleDate: '2026-11-07', pageSize: 30,
    }, afterMidnight);
  });

  it('denies a partial, invalid, duplicated or stale date cursor before privileged reads', async () => {
    const now = new Date('2026-11-07T07:59:59.000Z'); // Last Pacific minute of Nov 6
    for (const query of [
      { afterEdition: '1' },
      { cursorDate: '2026-11-06' },
      { afterEdition: '1', cursorDate: '2026-11-07' },
      { afterEdition: '1', cursorDate: '2026-02-30' },
      { afterEdition: '1', cursorDate: ['2026-11-06', '2026-11-06'] },
      { afterEdition: '0', cursorDate: '2026-11-06' },
    ]) {
      await expect(readCurrentOfficialDailyEditionChoice(query, {
        environment: ON, now,
      })).rejects.toMatchObject({ kind: 'invalid' });
    }
    expect(mocked.catalog).not.toHaveBeenCalled();
    expect(mocked.client).not.toHaveBeenCalled();
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
