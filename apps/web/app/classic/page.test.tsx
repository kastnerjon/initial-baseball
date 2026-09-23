import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASSIC_DAILY_RULESET_VERSION } from '@initial-baseball/shared';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string): never => {
    throw new Error(`redirect:${path}`);
  }),
  dailyModePage: vi.fn(async () => null),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('../components/DailyModePage', () => ({
  DailyModePage: mocks.dailyModePage,
}));

import ClassicInningPage from './page';

const originalClassicInningEnabled = process.env.CLASSIC_INNING_ENABLED;

beforeEach(() => {
  mocks.redirect.mockClear();
  mocks.dailyModePage.mockClear();
  delete process.env.CLASSIC_INNING_ENABLED;
});

afterEach(() => {
  if (originalClassicInningEnabled === undefined) {
    delete process.env.CLASSIC_INNING_ENABLED;
    return;
  }
  process.env.CLASSIC_INNING_ENABLED = originalClassicInningEnabled;
});

describe('/classic availability', () => {
  it('redirects to Daily Nine before composing Classic when disabled', async () => {
    await expect(ClassicInningPage()).rejects.toThrow('redirect:/');

    expect(mocks.redirect).toHaveBeenCalledWith('/');
    expect(mocks.dailyModePage).not.toHaveBeenCalled();
  });

  it('composes the existing Classic ruleset when explicitly enabled', async () => {
    process.env.CLASSIC_INNING_ENABLED = 'true';

    await ClassicInningPage();

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.dailyModePage).toHaveBeenCalledWith({
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
    });
  });
});
