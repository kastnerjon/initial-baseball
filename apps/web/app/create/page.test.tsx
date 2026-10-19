import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND'); } }));

import CreateLineupPage from './page';

afterEach(() => vi.unstubAllEnvs());

describe('default-off no-sign-in Custom creation screen', () => {
  it('stays unavailable unless both public issuance and v2 gameplay flags are enabled', () => {
    vi.stubEnv('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED', '');
    vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', 'true');
    expect(() => CreateLineupPage()).toThrow('NEXT_NOT_FOUND');
    vi.stubEnv('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED', 'true');
    vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', '');
    expect(() => CreateLineupPage()).toThrow('NEXT_NOT_FOUND');
  });

  it('reuses the accessible ordered picker but requires a name and hides admin UI', () => {
    vi.stubEnv('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED', 'true');
    vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', 'true');
    const html = renderToStaticMarkup(<CreateLineupPage />);
    expect(html).toContain('Create a Lineup');
    expect(html).toContain('Name your puzzle');
    expect(html).toContain('Puzzle name (3–60 characters)');
    expect(html).toContain('0 / 10 chosen');
    expect(html).toContain('Find a player');
    expect(html).toContain('Create challenge');
    expect(html).toContain('disabled=""');
    expect(html).toContain('No account required');
    expect(html).not.toContain('/admin/daily');
    expect(html).not.toContain('Admin-only staging');
    expect(html).not.toContain('href="/custom/');
  });
});
