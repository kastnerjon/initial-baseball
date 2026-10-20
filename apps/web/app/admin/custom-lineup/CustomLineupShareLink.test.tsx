import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CustomLineupShareLink, requestNativeCustomLineupShare } from './CustomLineupShareLink';

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

describe('native sharing for unlisted Custom Lineups', () => {
  const url = 'https://example.test/custom/' + ID;

  it('passes only the playable URL and public app title to the native share sheet', async () => {
    const share = vi.fn(async (_data: { title: string; url: string }) => undefined);
    expect(await requestNativeCustomLineupShare(url, share)).toBe('completed');
    expect(share).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledWith({ title: 'Initial Baseball Custom Lineup', url });
    expect(JSON.stringify(share.mock.calls)).not.toMatch(/ownerCapability|canonicalPlayerIds|progressionToken/i);
  });

  it('does not treat a cancelled system share sheet as a failed operation', async () => {
    const cancelled = Object.assign(new Error('dismissed'), { name: 'AbortError' });
    expect(await requestNativeCustomLineupShare(url, async () => { throw cancelled; }))
      .toBe('cancelled');
  });

  it('reports native share errors separately without changing the copy fallback', async () => {
    expect(await requestNativeCustomLineupShare(url, async () => {
      throw new Error('Native share unavailable');
    })).toBe('failed');
    const html = renderToStaticMarkup(<CustomLineupShareLink puzzleId={ID} />);
    expect(html).toContain('Copy challenge link');
    expect(html).not.toContain('Share challenge</button>');
  });
});
