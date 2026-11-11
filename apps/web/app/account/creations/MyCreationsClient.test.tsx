import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MyCreationsClient, { creationShareUrl, isCreation } from './MyCreationsClient';

const id = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';

describe('private My Creations guest sharing links', () => {
  it('creates only valid immutable same-origin HTTPS friend URLs', () => {
    expect(creationShareUrl(id, 'https://initialbaseball.com'))
      .toBe('https://initialbaseball.com/custom/' + id);
    expect(creationShareUrl(id, 'http://localhost:3000'))
      .toBe('http://localhost:3000/custom/' + id);
    for (const origin of ['https://initialbaseball.com/other', 'javascript:alert(1)',
      'http://initialbaseball.com', 'https://evil.example@initialbaseball.com',
      'https://initialbaseball.com?x=1']) {
      expect(creationShareUrl(id, origin)).toBeNull();
    }
    expect(creationShareUrl('custom-lineup-v2-../admin', 'https://initialbaseball.com'))
      .toBeNull();
    expect(creationShareUrl(id + '?token=secret', 'https://initialbaseball.com'))
      .toBeNull();
  });

  it('retains strict readback validation and never renders a secret-bearing link', () => {
    expect(isCreation({ puzzleId: id, title: 'Mets Legends',
      issuedAt: '2026-11-10T12:00:00Z' })).toBe(true);
    expect(isCreation({ puzzleId: id + '?private=answer', title: 'Mets Legends',
      issuedAt: '2026-11-10T12:00:00Z' })).toBe(false);
    const html = renderToStaticMarkup(<MyCreationsClient />);
    expect(html).toContain('My Creations');
    expect(html).not.toContain('private=answer');
    expect(html).not.toContain('canonical_player_ids');
  });
});
