import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AtBatCard } from './AtBatCard';

describe('AtBatCard pending resolution feedback', () => {
  it('acknowledges Give Up immediately while the reveal request is pending', () => {
    const html = renderCard({ requestPending: true, giveUpPending: true });

    expect(html).toContain('Revealing…');
    expect(html).toContain('aria-busy="true"');
  });

  it('does not show Give Up reveal copy for another pending resolution', () => {
    const html = renderCard({ requestPending: true, giveUpPending: false });

    expect(html).toContain('Give up');
    expect(html).not.toContain('Revealing…');
  });
});

function renderCard(input: { requestPending: boolean; giveUpPending: boolean }): string {
  return renderToStaticMarkup(
    <AtBatCard
      atBat={{ pitchNumber: 1, initials: 'JR' }}
      rulesetVersion="points-v2"
      state={{
        query: '',
        selectedPlayerId: null,
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
