import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  bootstrap: vi.fn(), enabled: vi.fn(),
}));
vi.mock('../serverOfficialDailyEditionChoice', () => ({
  isOfficialDailyEditionChooserVisible: mocked.enabled,
}));
vi.mock('../serverCanonicalRuntime', () => ({
  dailyRuntime: { getBootstrap: mocked.bootstrap },
}));
vi.mock('../gameAvailability', () => ({
  isClassicInningEnabled: () => false,
}));
vi.mock('../serverCustomLineupV2GameplayHttp', () => ({
  isCustomLineupV2GameplayTransportEnabled: () => false,
}));
vi.mock('./DailyInningGame', () => ({
  DailyInningGame: () => React.createElement('div', { id: 'primary-game' }),
}));
vi.mock('./DailyHowToDialog', () => ({
  DailyHowToDialog: () => React.createElement('div'),
}));
vi.mock('./DailyModeNavigation', () => ({
  DailyModeNavigation: () => React.createElement('nav'),
}));
vi.mock('./DailyFooter', () => ({
  DailyFooter: () => React.createElement('footer'),
}));
import { DailyModePage } from './DailyModePage';

beforeEach(() => {
  vi.clearAllMocks();
  mocked.enabled.mockReturnValue(false);
  mocked.bootstrap.mockImplementation(async (_date, rulesetVersion) => ({
    puzzle: { id: 'legacy-primary', puzzleDate: '2026-11-06', puzzleNumber: 194 },
    rulesetVersion, progressionToken: 'signed-legacy', hintBundle: null,
  }));
});

describe('Daily mode edition navigation', () => {
  it('keeps the primary gameplay and hides unlaunched chooser navigation', async () => {
    const html = renderToStaticMarkup(await DailyModePage({ rulesetVersion: 'points-v4' }));
    expect(html).toContain('primary-game');
    expect(html).toContain('Daily Nine');
    expect(html).not.toContain('Choose another official Daily puzzle');
  });
  it('shows the chooser link only in Daily Nine under the explicit gate', async () => {
    mocked.enabled.mockReturnValue(true);
    const html = renderToStaticMarkup(await DailyModePage({ rulesetVersion: 'points-v4' }));
    expect(html).toContain('primary-game');
    expect(html).toContain('href="/daily/editions"');
    expect(html).toContain('Choose another official Daily puzzle');
    const classic = renderToStaticMarkup(await DailyModePage({ rulesetVersion: 'classic-inning-v1' }));
    expect(classic).toContain('primary-game');
    expect(classic).not.toContain('Choose another official Daily puzzle');
  });
});
