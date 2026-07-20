import { describe, expect, it } from 'vitest';
import { getDailyProgressionSecret } from './dailyProgressionSecret';

const configuredSecret = 'configured-daily-progression-secret-0123456789';

describe('Daily progression secret resolution', () => {
  it('uses the configured server-only secret in production', () => {
    expect(getDailyProgressionSecret({
      NODE_ENV: 'production',
      DAILY_PROGRESSION_SECRET: configuredSecret,
    })).toBe(configuredSecret);
  });

  it('fails closed when production has no configured secret', () => {
    expect(() => getDailyProgressionSecret({ NODE_ENV: 'production' })).toThrow(/DAILY_PROGRESSION_SECRET/);
  });

  it('uses an explicit development-only fallback outside production', () => {
    expect(getDailyProgressionSecret({ NODE_ENV: 'development' })).toMatch(/development-progression-secret/);
  });
});
