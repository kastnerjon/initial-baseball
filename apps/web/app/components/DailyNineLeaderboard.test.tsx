import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyNineLeaderboard } from './DailyNineLeaderboard';
import { decodeDailyNineLeaderboard } from '../dailyNineLeaderboardClient';
(globalThis as Record<string, unknown>).React = React;
const puzzle = { id: 'daily-2026-10-08-editorial-v1', puzzleDate: '2026-10-08', puzzleNumber: 165 };
describe('Daily Nine leaderboard', () => {
  it('renders a name form only for the first active attempt', () => {
    const eligible = renderToStaticMarkup(<DailyNineLeaderboard puzzle={puzzle} completedAtBats={[]} attemptId="first-attempt" />);
    expect(eligible).toContain('Top 10');
    expect(eligible).toContain('Submit score');
    expect(eligible).toContain('Only your first attempt counts');
    const replay = renderToStaticMarkup(<DailyNineLeaderboard puzzle={puzzle} completedAtBats={[]} attemptId={null} />);
    expect(replay).not.toContain('Submit score');
    expect(replay).toContain('Replays do not qualify');
  });
  it('shows Top 10 while playing without premature submission or replay messaging', () => {
    const duringPlay = renderToStaticMarkup(<DailyNineLeaderboard puzzle={puzzle} viewOnly />);
    expect(duringPlay).toContain("Today's Top 10");
    expect(duringPlay).toContain('Only eligible first attempts can be submitted after completion.');
    expect(duringPlay).not.toContain('Submit score');
    expect(duringPlay).not.toContain('Replays do not qualify');
    expect(duringPlay).not.toContain('Your rank:');
  });
  it('decodes ties while rejecting invalid leaderboard results', () => {
    expect(() => decodeDailyNineLeaderboard({ totalEntries:2, leaders:[
      { displayName:'Alice', points:4, rank:1 }, { displayName:'Bob', points:4, rank:1 },
    ], ownEntry:null })).not.toThrow();
    expect(() => decodeDailyNineLeaderboard({ totalEntries:1, leaders:[{displayName:'Eve',points:999,rank:1}], ownEntry:null })).toThrow();
    expect(() => decodeDailyNineLeaderboard({ totalEntries:0, leaders:[{displayName:'A',points:1,rank:1}], ownEntry:null })).toThrow();
    expect(() => decodeDailyNineLeaderboard({ totalEntries:0, leaders:[], ownEntry:null })).not.toThrow();
  });
});
