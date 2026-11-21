import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../customV2CompletionDisplayBrowserTransport', () => ({
  createCustomV2CompletionDisplayBrowserTransport: vi.fn(() => ({
    read: vi.fn(), record: vi.fn(),
  })),
}));
import { CustomLineupCompletionDisplay, resolveCompletionDisplayAfterWrite } from './CustomLineupCompletionDisplay';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
describe('Custom Lineup first-result name shell', () => {
  it('shows a private loading state without inventing a name or result ID on SSR', () => {
    const html = renderToStaticMarkup(<CustomLineupCompletionDisplay puzzleId={ID} />);
    expect(html).toContain('How should your result appear?');
    expect(html).toContain('Checking your saved result choice');
    for (const forbidden of [
      'Guest', 'Anonymous.', 'canonicalPlayerIds', 'clueSnapshot', 'submissionId',
      ID, 'PRIVATE_NAME', '<form',
    ]) expect(html).not.toContain(forbidden);
  });
});

describe('Custom completion display immutable first-choice reconciliation', () => {
  it('shows the submitted choice only when the database created the first write', async () => {
    const readSaved = vi.fn(async () => ({ mode: 'anonymous' as const, displayName: null }));
    const saved = await resolveCompletionDisplayAfterWrite('created',
      { mode: 'named', displayName: 'Avi' }, readSaved);
    expect(saved).toEqual({ mode: 'named', displayName: 'Avi' });
    expect(readSaved).not.toHaveBeenCalled();
  });

  it('uses the server-authoritative name when an existing write won in another tab', async () => {
    const saved = await resolveCompletionDisplayAfterWrite('existing',
      { mode: 'named', displayName: 'Local losing name' }, async () =>
        ({ mode: 'named', displayName: 'First winner' }));
    expect(saved).toEqual({ mode: 'named', displayName: 'First winner' });
  });

  it('never displays a losing name over an original Anonymous choice', async () => {
    const saved = await resolveCompletionDisplayAfterWrite('existing',
      { mode: 'named', displayName: 'Different name' }, async () =>
        ({ mode: 'anonymous', displayName: null }));
    expect(saved).toEqual({ mode: 'anonymous', displayName: null });
  });

  it('fails closed rather than claiming the losing draft was saved if readback is missing', async () => {
    await expect(resolveCompletionDisplayAfterWrite('existing',
      { mode: 'anonymous', displayName: null }, async () => null)).rejects
      .toThrow('Original Custom result choice is unavailable.');
  });
});
