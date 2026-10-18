import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CustomLineupShareLink } from './CustomLineupShareLink';

const ID = 'custom-lineup-v2-12345678-1234-4234-8234-123456789abc';

describe('Custom Lineup issued share panel', () => {
  it('provides a selectable opaque URL and preview without answer or credential payloads', () => {
    const html = renderToStaticMarkup(<CustomLineupShareLink puzzleId={ID} />);
    expect(html).toContain('href="/custom/' + ID + '"');
    expect(html).toContain('value="/custom/' + ID + '"');
    expect(html).toContain('readOnly=""');
    expect(html).toContain('Copy challenge link');
    expect(html).toContain('Anyone with the link');
    expect(html).toContain('without contributing a competitive result');
    expect(html).not.toMatch(/canonicalPlayerIds|progressionToken|creatorCookie|authorization/i);
  });
});
