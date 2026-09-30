import { describe, expect, it } from 'vitest';
import {
  deriveCareerOnBasePercentage,
  deriveOnBasePercentage,
  hasCompleteObpSource,
} from './canonical-batting-rate-core.mjs';

describe('canonical batting rate derivation', () => {
  it('calculates Ernie Banks’s 1953 OBP under the pre-1954 sacrifice-fly convention', () => {
    const row = {
      season: 1953,
      atBats: 35,
      hits: 11,
      walks: 4,
      hitByPitch: 0,
      sacrificeFlies: null,
    };

    expect(hasCompleteObpSource([row])).toBe(true);
    expect(deriveOnBasePercentage(row)).toBe(15 / 39);
  });

  it('derives a career rate from aggregate counts instead of averaging season rates', () => {
    const seasonRows = [
      { season: 1953, atBats: 35, hits: 11, walks: 4, hitByPitch: 0, sacrificeFlies: null },
      { season: 1954, atBats: 500, hits: 100, walks: 20, hitByPitch: 10, sacrificeFlies: 5 },
    ];
    const careerTotals = {
      atBats: 535,
      hits: 111,
      walks: 24,
      hitByPitch: 10,
      sacrificeFlies: 5,
    };
    const seasonAverage = seasonRows
      .map(deriveOnBasePercentage)
      .reduce((sum, value) => sum + value, 0) / seasonRows.length;

    expect(hasCompleteObpSource(seasonRows)).toBe(true);
    expect(deriveCareerOnBasePercentage(careerTotals, seasonRows)).toBe(145 / 574);
    expect(deriveCareerOnBasePercentage(careerTotals, seasonRows)).not.toBe(seasonAverage);
  });

  it('derives career OBP when every season SF field is structurally absent', () => {
    const seasonRows = [
      { season: 1937, atBats: 100, hits: 25, walks: 10, hitByPitch: 1, sacrificeFlies: null },
      { season: 1944, atBats: 200, hits: 50, walks: 20, hitByPitch: 2, sacrificeFlies: null },
    ];
    const careerTotals = {
      atBats: 300,
      hits: 75,
      walks: 30,
      hitByPitch: 3,
      sacrificeFlies: null,
    };

    expect(deriveCareerOnBasePercentage(careerTotals, seasonRows)).toBe(108 / 333);
  });

  it('keeps OBP unavailable when a required source component is unknown', () => {
    expect(deriveOnBasePercentage({
      season: 1953,
      atBats: 35,
      hits: 11,
      walks: 4,
      hitByPitch: null,
      sacrificeFlies: null,
    })).toBeNull();

    const post1954MissingSacrificeFlies = {
      season: 1954,
      atBats: 500,
      hits: 100,
      walks: 20,
      hitByPitch: 10,
      sacrificeFlies: null,
    };
    expect(hasCompleteObpSource([post1954MissingSacrificeFlies])).toBe(false);
    expect(deriveOnBasePercentage(post1954MissingSacrificeFlies)).toBeNull();

    const missing1939SacrificeFlies = {
      season: 1939,
      atBats: 100,
      hits: 25,
      walks: 10,
      hitByPitch: 1,
      sacrificeFlies: null,
    };
    expect(hasCompleteObpSource([missing1939SacrificeFlies])).toBe(false);
    expect(deriveOnBasePercentage(missing1939SacrificeFlies)).toBeNull();
  });

  it('preserves explicit zero values as known inputs', () => {
    const row = {
      season: 1960,
      atBats: 10,
      hits: 2,
      walks: 0,
      hitByPitch: 0,
      sacrificeFlies: 0,
    };

    expect(hasCompleteObpSource([row])).toBe(true);
    expect(deriveOnBasePercentage(row)).toBe(0.2);
  });
});
