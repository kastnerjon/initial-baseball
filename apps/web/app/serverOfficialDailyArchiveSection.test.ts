import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  isOfficialDailyArchiveVisible, parseOfficialDailyArchiveCursor,
} from './serverOfficialDailyArchiveSection';

const ON = {
  OFFICIAL_DAILY_EDITION_ARCHIVE_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_HTTP_ENABLED: 'true',
  OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED: 'true',
};

describe('strict unified official Daily Archive gating and cursor', () => {
  it('defaults OFF and requires every flag to be exact true', () => {
    expect(isOfficialDailyArchiveVisible({})).toBe(false);
    expect(isOfficialDailyArchiveVisible(ON)).toBe(true);
    for (const key of Object.keys(ON)) {
      for (const value of ['TRUE', 'false', '', ' true ']) {
        expect(isOfficialDailyArchiveVisible({ ...ON, [key]: value })).toBe(false);
      }
    }
  });

  it('accepts no cursor or an exact past date and positive edition', () => {
    expect(parseOfficialDailyArchiveCursor({})).toEqual({});
    expect(parseOfficialDailyArchiveCursor({
      afterDate: '2026-11-05', afterEdition: '2',
    })).toEqual({ after: { puzzleDate: '2026-11-05', editionNumber: 2 } });
  });

  it('rejects incomplete, malformed and injected cursors', () => {
    for (const query of [
      { afterDate: '2026-11-05' },
      { afterEdition: '1' },
      { afterDate: '2026-11-05', afterEdition: '02' },
      { afterDate: '2026-11-05', afterEdition: '0' },
      { afterDate: '2026-11-05', afterEdition: '1.5' },
      { afterDate: '2026-11-05', afterEdition: '9999999999999999' },
      { afterDate: '2026-11-05', afterEdition: ['1','2'] },
      { afterDate: '2026-02-30', afterEdition: '2' },
      { afterDate: '2026-11-05,or', afterEdition: '2' },
      { afterDate: '2026-11-05', afterEdition: '2', debug: '1' },
    ]) {
      expect(() => parseOfficialDailyArchiveCursor(query)).toThrow();
    }
  });
});
