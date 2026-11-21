import { describe, expect, it, vi } from 'vitest';
import { readOfficialDailyCompetitiveSigningKeys } from './officialDailyCompetitiveSigningKeys';

vi.mock('server-only', () => ({}));

const ACTIVE = 'active-official-daily-secret-0123456789abcdef';
const LEGACY = 'legacy-official-daily-secret-0123456789abcdef';
const OTHER = 'older-official-daily-secret-0123456789abcdef';

describe('official Daily competitive signing keyring', () => {
  it('defaults to one active key and accepts distinct bounded verification-only keys', () => {
    expect(readOfficialDailyCompetitiveSigningKeys({
      OFFICIAL_DAILY_COMPETITIVE_SECRET: ACTIVE,
    })).toEqual({ active: ACTIVE, legacy: [] });
    expect(readOfficialDailyCompetitiveSigningKeys({
      OFFICIAL_DAILY_COMPETITIVE_SECRET: ACTIVE,
      OFFICIAL_DAILY_COMPETITIVE_LEGACY_SECRETS_JSON: JSON.stringify([LEGACY, OTHER]),
    })).toEqual({ active: ACTIVE, legacy: [LEGACY, OTHER] });
  });

  it('fails closed for malformed, weak, repeated and oversized legacy verification keys', () => {
    const common = { OFFICIAL_DAILY_COMPETITIVE_SECRET: ACTIVE };
    for (const invalid of [
      'not json', '{}', '"string"', JSON.stringify(['short']),
      JSON.stringify([ACTIVE]), JSON.stringify([LEGACY, LEGACY]),
      JSON.stringify([' ' + LEGACY]), JSON.stringify(Array.from({ length: 9 }, (_, i) =>
        'legacy-test-secret-number-' + i + '-0123456789abcdef')),
    ]) {
      expect(() => readOfficialDailyCompetitiveSigningKeys({
        ...common, OFFICIAL_DAILY_COMPETITIVE_LEGACY_SECRETS_JSON: invalid,
      })).toThrow(/configuration invalid/);
    }
    expect(() => readOfficialDailyCompetitiveSigningKeys({})).toThrow(/unavailable/);
  });
});
