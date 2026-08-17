import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AtBatCard } from './AtBatCard';

(globalThis as Record<string, unknown>).React = React;

describe('AtBatCard pending resolution feedback', () => {
  it('acknowledges Give Up immediately while the reveal request is pending', () => {
    const html = renderCard({ requestPending: true, giveUpPending: true });

    expect(html).toContain('Revealing…');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Submit Guess');
    expect(html).not.toContain('Checking…');
  });

  it('acknowledges Submit Guess immediately while guess resolution is pending', () => {
    const html = renderCard({
      requestPending: true,
      giveUpPending: false,
      selectedPlayerId: 'player-id',
    });

    expect(html).toContain('Checking…');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Give up');
    expect(html).not.toContain('Revealing…');
  });

  it('keeps ordinary action copy when no resolution is pending', () => {
    const html = renderCard({
      requestPending: false,
      giveUpPending: false,
      selectedPlayerId: 'player-id',
    });

    expect(html).toContain('Give up');
    expect(html).toContain('Submit Guess');
    expect(html).not.toContain('Revealing…');
    expect(html).not.toContain('Checking…');
  });
});

function renderCard(input: {
  requestPending: boolean;
  giveUpPending: boolean;
  selectedPlayerId?: string | null;
}): string {
  return renderToStaticMarkup(
    <AtBatCard
      atBat={{ pitchNumber: 1, initials: 'JR' }}
      rulesetVersion="points-v2"
      state={{
        query: '',
        selectedPlayerId: input.selectedPlayerId ?? null,
        revealCount: 0,
        revealedHints: [],
        strikeCount: 0,
        submittedResult: null,
        reveal: null,
      }}
      requestPending={input.requestPending}
      giveUpPending={input.giveUpPending}
      requestError={null}
      onQueryChange={() => undefined}
      onSelectPlayer={() => undefined}
      onRevealHint={() => undefined}
      onSubmit={() => undefined}
      onGiveUp={() => undefined}
      onNextPitch={() => undefined}
    />,
  );
}
