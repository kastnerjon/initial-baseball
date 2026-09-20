import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DailyNineAtBatComparisonState } from '../useDailyNineAtBatComparison';
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
    expect(html).toContain('Reveal Next Hint · −1 point');
    expect(html).not.toContain('Revealing…');
    expect(html).not.toContain('Checking…');
  });

  it('uses the supplied terminal action label after a resolved at-bat', () => {
    const html = renderCard({
      requestPending: false,
      giveUpPending: false,
      submittedResult: {
        kind: 'strikeout',
        revealedCount: 0,
        strikeCount: 3,
        outcome: 'K',
        source: 'strikeout',
      },
      nextActionLabel: 'View Results',
    });

    expect(html).toContain('View Results');
    expect(html).not.toContain('Next At Bat');
  });

  it('renders terminal YOU / AVG loading without changing the next action', () => {
    const html = renderCard({
      requestPending: false,
      giveUpPending: false,
      submittedResult: {
        kind: 'strikeout',
        revealedCount: 0,
        strikeCount: 3,
        outcome: 'K',
        source: 'strikeout',
      },
      comparison: { status: 'loading', ownPoints: 0 },
    });

    expect(html).toContain('YOU');
    expect(html).toContain('AVG');
    expect(html).toContain('Loading comparison…');
    expect(html).toContain('Next At Bat');
  });

  it('hides tiny-sample averages and labels early averages explicitly', () => {
    const waiting = renderTerminalComparison({
      status: 'success',
      ownPoints: 5,
      resolvedAtBatCount: 1,
      averagePoints: 4,
    });
    const early = renderTerminalComparison({
      status: 'success',
      ownPoints: 5,
      resolvedAtBatCount: 7,
      averagePoints: 3.428,
    });

    expect(waiting).toContain('Waiting for more results · 1 result');
    expect(waiting).not.toContain('4.0');
    expect(early).toContain('3.4');
    expect(early).toContain('Early average · 7 results');
  });

  it('renders normal and quiet unavailable comparison states', () => {
    const normal = renderTerminalComparison({
      status: 'success',
      ownPoints: 6,
      resolvedAtBatCount: 10,
      averagePoints: 4.25,
    });
    const unavailable = renderTerminalComparison({
      status: 'unavailable',
      ownPoints: 6,
    });

    expect(normal).toContain('4.3');
    expect(normal).toContain('10 results');
    expect(normal).not.toContain('Early average');
    expect(unavailable).toContain('Comparison unavailable');
    expect(unavailable).toContain('Next At Bat');
  });

  it('announces the current strike count and does not render a hidden reveal while active', () => {
    const html = renderCard({ requestPending: false, giveUpPending: false });
    expect(html).toContain('aria-label="0 of 3 strikes"');
    expect(html).not.toContain('Player Reveal');
    expect(html).not.toContain('player-reveal-stat-strip');
  });

  it('does not show an empty search-results state after a player is selected', () => {
    const html = renderCard({
      requestPending: false,
      giveUpPending: false,
      selectedPlayerId: 'player-id',
      query: 'Ken Griffey Jr.',
    });

    expect(html).toContain('search-shell-selected');
    expect(html).not.toContain('No matching players');
  });
});

function renderCard(input: {
  requestPending: boolean;
  giveUpPending: boolean;
  selectedPlayerId?: string | null;
  query?: string;
  rulesetVersion?: 'points-v2' | 'points-v3';
  submittedResult?: {
    kind: 'strikeout';
    revealedCount: 0;
    strikeCount: number;
    outcome: 'K';
    source: 'strikeout';
  };
  nextActionLabel?: string;
  comparison?: DailyNineAtBatComparisonState;
}): string {
  return renderToStaticMarkup(
    <AtBatCard
      atBat={{ pitchNumber: 1, initials: 'JR' }}
      rulesetVersion={input.rulesetVersion ?? 'points-v3'}
      state={{
        query: input.query ?? '',
        selectedPlayerId: input.selectedPlayerId ?? null,
        revealCount: 0,
        revealedHints: [],
        strikeCount: 0,
        submittedResult: input.submittedResult ?? null,
        reveal: null,
      }}
      requestPending={input.requestPending}
      giveUpPending={input.giveUpPending}
      requestError={null}
      comparison={input.comparison ?? { status: 'idle' }}
      {...(input.nextActionLabel === undefined ? {} : { nextActionLabel: input.nextActionLabel })}
      onQueryChange={() => undefined}
      onSelectPlayer={() => undefined}
      onRevealHint={() => undefined}
      onSubmit={() => undefined}
      onGiveUp={() => undefined}
      onNextPitch={() => undefined}
    />,
  );
}


function renderTerminalComparison(comparison: DailyNineAtBatComparisonState): string {
  return renderCard({
    requestPending: false,
    giveUpPending: false,
    submittedResult: {
      kind: 'strikeout',
      revealedCount: 0,
      strikeCount: 3,
      outcome: 'K',
      source: 'strikeout',
    },
    comparison,
  });
}
