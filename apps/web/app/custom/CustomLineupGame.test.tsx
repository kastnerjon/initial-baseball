import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../customLineupV2BrowserTransport', () => ({
  createCustomLineupV2BrowserTransport: vi.fn(() => ({
    bootstrap: vi.fn(), revealHint: vi.fn(), resolve: vi.fn(), submit: vi.fn(),
  })),
}));
import { CustomLineupGame } from './CustomLineupGame';
import { CustomLineupCompletionDisplay } from './CustomLineupCompletionDisplay';

describe('Custom Lineup v2 first render', () => {
  it('renders a user title as escaped text, without changing the loading game rules', () => {
    const html = renderToStaticMarkup(<CustomLineupGame
      puzzleId="custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000"
      displayTitle="Mets & Friends" />);
    expect(html).toContain('Mets &amp; Friends');
    expect(html).toContain('Opening your lineup');
    expect(html).not.toContain('canonicalPlayerIds');
    expect(html).not.toContain('clueSnapshot');
  });
  it('shows only an intentional loading shell with no puzzle answers or browser state', () => {
    const html = renderToStaticMarkup(
      <CustomLineupGame puzzleId="custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000" />,
    );
    expect(html).toContain('Custom Lineup');
    expect(html).toContain('Opening your lineup');
    expect(html).toContain('aria-label="Initial Baseball home"');
    expect(html).not.toContain('canonicalPlayerIds');
    expect(html).not.toContain('progressionToken');
    expect(html).not.toContain('PRIVATE_ANSWER');
    expect(html).not.toContain('Guess player');
  });
});
describe('Custom completion identity presentation remains a gated post-admission subview', () => {
  it('has an inert loading first render with no stored names or result identity', () => {
    const html = renderToStaticMarkup(<CustomLineupCompletionDisplay
      puzzleId="custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000" />);
    expect(html).toContain('Checking your saved display choice');
    expect(html).not.toContain('Guest Hero');
    expect(html).not.toContain('submissionId');
    expect(html).not.toContain('score');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Save name');
  });
  it('does not activate the display component on the initial game render', () => {
    const html = renderToStaticMarkup(<CustomLineupGame
      puzzleId="custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000"
      completionDisplayEnabled />);
    expect(html).not.toContain('Your name on this result');
    expect(html).not.toContain('Save name');
  });
});
