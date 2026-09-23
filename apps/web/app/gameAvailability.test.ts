import { afterEach, describe, expect, it } from 'vitest';
import { isClassicInningEnabled } from './gameAvailability';

const originalClassicInningEnabled = process.env.CLASSIC_INNING_ENABLED;

afterEach(() => {
  if (originalClassicInningEnabled === undefined) {
    delete process.env.CLASSIC_INNING_ENABLED;
    return;
  }
  process.env.CLASSIC_INNING_ENABLED = originalClassicInningEnabled;
});

describe('Classic Inning availability', () => {
  it('defaults off when the server setting is absent', () => {
    delete process.env.CLASSIC_INNING_ENABLED;
    expect(isClassicInningEnabled()).toBe(false);
  });

  it('enables Classic only for the explicit true value', () => {
    expect(isClassicInningEnabled('true')).toBe(true);
    expect(isClassicInningEnabled('false')).toBe(false);
    expect(isClassicInningEnabled('TRUE')).toBe(false);
    expect(isClassicInningEnabled('1')).toBe(false);
  });
});
