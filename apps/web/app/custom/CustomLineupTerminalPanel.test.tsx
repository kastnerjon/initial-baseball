import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../components/PlayerRevealCard', () => ({
  PlayerRevealCard: ({ reveal }: { reveal: { displayName: string } }) =>
    <div aria-label="Player reveal">{reveal.displayName}</div>,
}));
import type { CustomLineupV2BrowserResolution } from '../customLineupV2BrowserTransport';
import { CustomLineupTerminalPanel } from './CustomLineupTerminalPanel';

const terminal: Extract<CustomLineupV2BrowserResolution, {kind:'terminal'}> = {
  kind:'terminal', progressionToken:'signed-next', revision:1, completed:false,
  hintBundle:{pitchNumber:2,revealedCount:0,hints:[],checkpoints:[]},
  result:{kind:'correct',outcome:'HR',source:'initials',revealedCount:0},
  reveal:{
    playerId:'ibp_'+'a'.repeat(20),displayName:'Test Reveal',
    playerType:'hitter',primaryPosition:'RF',yearsPlayedDisplay:'1990–2000',
    teamIds:['NYM'],career:{lines:[{kind:'hitter',stats:{HR:40}}]},seasons:[],
  },
};

function render(error: string | null, completed = false): string {
  return renderToStaticMarkup(
    <CustomLineupTerminalPanel terminal={{...terminal, completed,
      hintBundle:completed?null:terminal.hintBundle}}
      error={error} loading={false} onContinue={() => {}} />,
  );
}

describe('Custom v2 terminal restore feedback', () => {
  it('keeps authorized terminal reveal and retry action with visible restore failure', () => {
    const html = render('Could not reach the game server. Your saved progress has not been reset.');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Could not reach the game server.');
    expect(html).toContain('Test Reveal');
    expect(html).toContain('Next batter');
    expect(html).not.toContain('canonicalPlayerIds');
  });

  it('does not invent an error before a failed restore, or alter the final-action label', () => {
    expect(render(null)).not.toContain('role="alert"');
    expect(render(null, true)).toContain('View final score');
    expect(render('Temporary failure',true)).toContain('Temporary failure');
  });
});
