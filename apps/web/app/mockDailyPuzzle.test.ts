import { describe, expect, it } from 'vitest';
import type { Player } from '@initial-baseball/shared';
import { baseballPlayers } from '@initial-baseball/baseball-data';
import { buildDefaultDailyHints } from './buildDefaultDailyHints';
import { DEMO_DAILY_PITCHES } from './mockDailyPuzzle';

describe('buildDefaultDailyHints', () => {
  it('builds default hints from a generated player in the expected order', () => {
    const player: Player = {
      id: 'player-1',
      fullName: 'Ken Griffey Jr.',
      displayName: 'Ken Griffey Jr.',
      primaryRole: 'hitter',
      primaryPosition: 'CF',
      mainDecade: '1990s',
      primaryTeam: 'SEA',
      teamsDisplay: 'SEA, CIN, CHW',
      statsLine: 'HR 630 / RBI 1836 / BA .284 / OBP .370 / SB 184',
      aliases: ['The Kid'],
    };

    expect(buildDefaultDailyHints(player)).toEqual([
      { hintType: 'main_decade', hintLabel: 'Main Decade', hintValue: '1990s' },
      { hintType: 'teams', hintLabel: 'Teams', hintValue: 'SEA, CIN, CHW' },
      { hintType: 'position', hintLabel: 'Position', hintValue: 'CF' },
      { hintType: 'stats', hintLabel: 'Stats', hintValue: 'HR 630 / RBI 1836 / BA .284 / OBP .370 / SB 184' },
    ]);
  });

  it('uses fallback labels when generated fields are unavailable', () => {
    const player: Player = {
      id: 'player-2',
      fullName: 'Mystery Player',
      displayName: 'Mystery Player',
      primaryRole: 'hitter',
      primaryPosition: 'Unknown',
      mainDecade: 'Unknown',
      primaryTeam: '',
      teamsDisplay: '',
      statsLine: '',
      aliases: [],
    };

    expect(buildDefaultDailyHints(player).map((hint) => hint.hintValue)).toEqual([
      'Unknown',
      'Teams unavailable',
      'Unknown',
      'Stats unavailable',
    ]);
  });
});

describe('DEMO_DAILY_PITCHES', () => {
  it('resolves all expected generated demo players', () => {
    expect(DEMO_DAILY_PITCHES.map((pitch) => pitch.player.fullName)).toEqual([
      'Ken Griffey Jr.',
      'David Wright',
      'CC Sabathia',
      'Andruw Jones',
      'Jason Varitek',
      'Hideki Matsui',
    ]);
  });

  it('gives every demo pitch exactly four hints in the default order', () => {
    for (const pitch of DEMO_DAILY_PITCHES) {
      expect(pitch.hints).toHaveLength(4);
      expect(pitch.hints.map((hint) => hint.hintType)).toEqual([
        'main_decade',
        'teams',
        'position',
        'stats',
      ]);
    }
  });

  it('uses the resolved generated player statsLine as the stats hint', () => {
    for (const pitch of DEMO_DAILY_PITCHES) {
      const statsHint = pitch.hints[3];
      const generatedPlayer = baseballPlayers.find((player) => player.id === pitch.correctPlayerId);

      expect(statsHint?.hintType).toBe('stats');
      expect(generatedPlayer).toBeDefined();
      expect(statsHint?.hintValue).toBe(generatedPlayer?.statsLine);
    }
  });

  it('uses the resolved generated player mainDecade and chronological teams display hints', () => {
    for (const pitch of DEMO_DAILY_PITCHES) {
      const generatedPlayer = baseballPlayers.find((player) => player.id === pitch.correctPlayerId);
      const mainDecadeHint = pitch.hints[0];
      const teamsHint = pitch.hints[1];

      expect(generatedPlayer).toBeDefined();
      expect(mainDecadeHint?.hintType).toBe('main_decade');
      expect(mainDecadeHint?.hintValue).toBe(generatedPlayer?.mainDecade);
      expect(teamsHint?.hintType).toBe('teams');
      expect(teamsHint?.hintValue).toBe(generatedPlayer?.teamsDisplay);
    }
  });

  it('derives pitch player kind and primaryPosition from the resolved generated player', () => {
    for (const pitch of DEMO_DAILY_PITCHES) {
      const generatedPlayer = baseballPlayers.find((player) => player.id === pitch.correctPlayerId);

      expect(generatedPlayer).toBeDefined();
      expect(pitch.player.kind).toBe(generatedPlayer?.primaryRole);
      expect(pitch.player.primaryPosition).toBe(generatedPlayer?.primaryPosition);
    }
  });

  it('keeps expected generated stats hints for Ken Griffey Jr. and CC Sabathia', () => {
    const kenGriffeyJrPitch = DEMO_DAILY_PITCHES.find((pitch) => pitch.player.fullName === 'Ken Griffey Jr.');
    const ccSabathiaPitch = DEMO_DAILY_PITCHES.find((pitch) => pitch.player.fullName === 'CC Sabathia');

    expect(kenGriffeyJrPitch?.hints[3]?.hintValue).toContain('HR 630');
    expect(ccSabathiaPitch?.hints[3]?.hintValue).toContain('W 251');
    expect(ccSabathiaPitch?.hints[3]?.hintValue).toContain('K 3093');
  });

  it('does not include WAR or bWAR in generated stats hints', () => {
    for (const pitch of DEMO_DAILY_PITCHES) {
      const statsHint = pitch.hints[3];

      expect(statsHint?.hintValue).not.toContain('WAR');
      expect(statsHint?.hintValue).not.toContain('bWAR');
    }
  });
});
