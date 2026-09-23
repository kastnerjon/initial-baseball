import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyModeNavigation } from './DailyModeNavigation';

(globalThis as Record<string, unknown>).React = React;

describe('DailyModeNavigation', () => {
  it('renders no mode toggle while Classic is unavailable', () => {
    const html = renderToStaticMarkup(
      <DailyModeNavigation currentPath="/" classicInningEnabled={false} />,
    );

    expect(html).toBe('');
  });

  it('restores the existing Daily Nine / Classic navigation when enabled', () => {
    const html = renderToStaticMarkup(
      <DailyModeNavigation currentPath="/classic" classicInningEnabled />,
    );

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/classic"');
    expect(html).toContain('Daily Nine');
    expect(html).toContain('Classic Inning');
    expect(html).toContain('aria-current="page"');
  });
});
