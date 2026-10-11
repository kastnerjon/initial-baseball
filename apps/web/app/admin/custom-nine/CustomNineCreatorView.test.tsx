import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CustomNineCreatorView } from './CustomNineCreatorView';

describe('Custom Nine creator initial view', () => {
  it('shows nine ordered empty places, search and disabled issuance without revealing answers', () => {
    const html = renderToStaticMarkup(<CustomNineCreatorView />);
    expect(html).toContain('Create a Custom Nine');
    expect(html).toContain('9 chosen');
    expect((html.match(/Choose a player/g) ?? []).length).toBe(9);
    expect(html).toContain('Find a player');
    expect(html).toContain('Issue immutable challenge');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Admin-only staging');
    expect(html).not.toContain('canonicalPlayerIds');
    expect(html).not.toContain('SECRET_SIGNED_TOKEN');
  });
});
