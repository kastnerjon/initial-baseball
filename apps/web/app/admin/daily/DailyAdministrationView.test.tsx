import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DailyEditorialHorizonPuzzle } from '@initial-baseball/daily';
import { DailyAdministrationView } from './DailyAdministrationView';

const futurePuzzle = {
  puzzleDate: '2026-11-24',
  puzzleNumber: 212,
  status: 'scheduled',
  revision: 2,
  selections: [{
    slot: 1,
    source: 'manual',
    player: {
      canonicalPlayerId: 'private-canonical-id',
      recognizabilityRank: 11,
      player: {
        displayName: 'Future Player',
        yearsPlayedDisplay: '1990–2010',
        primaryRole: 'hitter',
        primaryPosition: 'CF',
        teamsDisplay: 'NYM',
      },
    },
  }],
  validation: {
    valid: true,
    slots: [{ slot: 1, warnings: [], lastDailyUsage: null, expectedMinimumRank: 10, expectedMaximumRank: 100 }],
  },
} as unknown as DailyEditorialHorizonPuzzle;

describe('Daily administration listing', () => {
  it('shows today, past lineup names, and future editor without visible rank or canonical IDs', () => {
    const html = renderToStaticMarkup(<DailyAdministrationView
      puzzles={[futurePuzzle]}
      selection={null}
      replacementComplete={false}
      lifecycleActionComplete={null}
      archiveBetaStartDate="2026-10-01"
      currentDate="2026-11-23"
      todayLineup={{
        puzzleDate: '2026-11-23', puzzleNumber: 211, status: 'scheduled',
        players: [{ slot: 1, displayName: 'Today Player', yearsPlayedDisplay: '2000–2010' }],
      }}
      historyLineups={[{
        puzzleDate: '2026-11-22', puzzleNumber: 210, status: 'fallback',
        players: [{ slot: 1, displayName: 'Past Player', yearsPlayedDisplay: '1980–2000' }],
      }]}
      historyWindow={{
        startDate: '2026-10-24', endDate: '2026-11-22',
        olderEndDate: '2026-10-23', newerEndDate: null,
      }}
    />);
    expect(html).toContain('Today&#x27;s lineup');
    expect(html).toContain('Today Player');
    expect(html).toContain('Past Daily lineups');
    expect(html).toContain('Past Player');
    expect(html).toContain('Original generated lineup');
    expect(html).toContain('Upcoming Daily lineups · next 30 days');
    expect(html).toContain('Future Player');
    expect(html).toContain('historyEnd=2026-10-23');
    expect(html).not.toContain('private-canonical-id');
    expect(html).not.toContain('Canonical ID');
    expect(html).not.toContain('>Rank<');
    expect(html).not.toContain('10–100');
  });
});
