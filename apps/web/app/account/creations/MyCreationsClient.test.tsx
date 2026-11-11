import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MyCreationsClient, {
  appendCreationsPage, CreationRow, creationShareUrl, isCreation, parseCreationsPage,
} from './MyCreationsClient';

const id = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const accountScope = 'a'.repeat(64);
const creation = { puzzleId: id, title: 'Mets Legends', issuedAt: '2026-11-10T12:00:00Z' };

describe('private My Creations guest links and paginated readback', () => {
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

  it('validates bounded pages, cursor shape and duplicate-free immutable IDs', () => {
    const page = { accountScope, creations: [creation], nextCursor: null };
    expect(isCreation(creation)).toBe(true);
    expect(parseCreationsPage(page)).toEqual(page);
    const forty = Array.from({ length: 40 }, (_, i) => ({
      ...creation, puzzleId: 'custom-lineup-v2-123e4567-e89b-42d3-a456-'
        + i.toString(16).padStart(12, '0'),
    }));
    expect(parseCreationsPage({ accountScope, creations: forty, nextCursor: 'opaque-cursor' }))
      .not.toBeNull();
    for (const invalid of [
      { accountScope, creations: [creation], nextCursor: 'opaque-cursor' },
      { accountScope, creations: [creation, creation], nextCursor: null },
      { accountScope, creations: [creation], nextCursor: 'x'.repeat(200) },
      { accountScope, creations: [{ ...creation, puzzleId: id + '?secret=1' }], nextCursor: null },
      { accountScope, creations: [creation] },
      { creations: [creation], nextCursor: null },
      { accountScope: 'invalid', creations: [creation], nextCursor: null },
    ]) expect(parseCreationsPage(invalid)).toBeNull();
  });

  it('never combines a first account page with a later page from another session', () => {
    const older = { ...creation, puzzleId: id.replace(/0$/, '1'), title: 'Older lineup' };
    const next = { accountScope, creations: [creation, older], nextCursor: null };
    expect(appendCreationsPage([creation], accountScope, next)).toEqual([creation, older]);
    // The server can validly return B's page after account cookies change in another tab.
    // That page must clear A's retained list, even when B has no older creations.
    expect(appendCreationsPage([creation], accountScope, {
      ...next, accountScope: 'b'.repeat(64),
    })).toBeNull();
    expect(appendCreationsPage([creation], accountScope, {
      accountScope: 'b'.repeat(64), creations: [], nextCursor: null,
    })).toBeNull();
    expect(appendCreationsPage([creation], null, next)).toBeNull();
  });

  it('renders populated metadata without private source, hints or owner tokens', () => {
    const enriched = {
      ...creation, canonical_player_ids: ['PRIVATE_PLAYER'], clueSnapshot: 'PRIVATE_HINT',
      ownerCode: 'PRIVATE_OWNER_TOKEN',
    };
    const html = renderToStaticMarkup(<ol>
      <CreationRow creation={enriched} copyStatus={null} onCopy={() => undefined} />
    </ol>);
    expect(html).toContain('Mets Legends');
    expect(html).toContain('/custom/' + id);
    for (const forbidden of ['PRIVATE_PLAYER', 'PRIVATE_HINT', 'PRIVATE_OWNER_TOKEN',
      'canonical_player_ids', 'clueSnapshot', 'ownerCode']) {
      expect(html).not.toContain(forbidden);
    }
    expect(renderToStaticMarkup(<MyCreationsClient />)).toContain('My Creations');
  });
});
