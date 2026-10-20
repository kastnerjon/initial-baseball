import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyFooter } from './DailyFooter';

describe('Daily footer public creator navigation', () => {
  it('preserves the archive footer and hides creation by default', () => {
    const html = renderToStaticMarkup(<DailyFooter createLineupAvailable={false} />);
    expect(html).toContain('href="/archive"');
    expect(html).toContain('New puzzle · Midnight Pacific');
    expect(html).not.toContain('href="/create"');
  });

  it('shows a link, but no puzzle data, once the server enables creation', () => {
    const html = renderToStaticMarkup(<DailyFooter createLineupAvailable />);
    expect(html).toContain('<a href="/create">Create a Lineup</a>');
    expect(html).toContain('href="/archive"');
    expect(html).not.toContain('custom-lineup-v2-');
    expect(html).not.toContain('canonicalPlayerIds');
  });
});
