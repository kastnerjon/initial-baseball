import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DailyNineAtBatComparisonState } from '../dailyNineAtBatComparisonState';
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

  it('never reveals a prefetched comparison while the at-bat is active', () => {
    const html = renderCard({
      requestPending: false,
      giveUpPending: false,
      comparison: {
        status: 'success',
        ownPoints: 7,
        resolvedAtBatCount: 12,
        averagePoints: 4.5,
        strictLowerAtBatRate: null,
      },
    });

    expect(html).not.toContain('At-bat comparison');
    expect(html).not.toContain('>AVG<');
    expect(html).not.toContain('12 results');
    expect(html).not.toContain('4.5');
  });

  it('keeps prefetched histogram bars hidden before an at-bat is resolved', () => {
    const html = renderCard({
      requestPending: false, giveUpPending: false,
      comparison: {
        status: 'success', ownPoints: 2, resolvedAtBatCount: 1,
        averagePoints: 2, strictLowerAtBatRate: 0,
        rulesetVersion: 'points-v4',
        scoreHistogram: [0, 0, 0, 0, 1, 0, 0, 0, 0],
      },
    });
    expect(html).not.toContain('at-bat-distribution');
    expect(html).not.toContain('How everyone scored');
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

  it('shows one-other-result AVG/BEAT and does not add a separate early-sample threshold', () => {
    const oneOther = renderTerminalComparison({
      status: 'success',
      ownPoints: 5,
      resolvedAtBatCount: 1,
      averagePoints: 4,
      strictLowerAtBatRate: 1,
    });
    const severalOthers = renderTerminalComparison({
      status: 'success',
      ownPoints: 5,
      resolvedAtBatCount: 7,
      averagePoints: 3.428,
      strictLowerAtBatRate: 0.5,
    });

    expect(oneOther).toContain('4.0');
    expect(oneOther).toContain('BEAT 100%');
    expect(oneOther).toContain('Above AVG');
    expect(oneOther).toContain('1 other result');
    expect(severalOthers).toContain('3.4');
    expect(severalOthers).toContain('BEAT 50%');
    expect(severalOthers).toContain('7 other results');
    expect(severalOthers).not.toContain('Early average');
  });

  it('renders normal and quiet unavailable comparison states', () => {
    const normal = renderTerminalComparison({
      status: 'success',
      ownPoints: 6,
      resolvedAtBatCount: 10,
      averagePoints: 4.25,
      strictLowerAtBatRate: 0.6,
    });
    const unavailable = renderTerminalComparison({
      status: 'unavailable',
      ownPoints: 6,
    });

    expect(normal).toContain('4.3');
    expect(normal).toContain('10 other results');
    expect(normal).toContain('BEAT 60%');
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
      terminalAwardedPoints={input.submittedResult === undefined ? null : 0}
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
