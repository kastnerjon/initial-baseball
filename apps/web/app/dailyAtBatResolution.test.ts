import { describe, expect, it } from 'vitest';
import type { DailyGameState } from '@initial-baseball/shared';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';
import {
  resolveDailyTerminalAtBat,
  type PendingAtBatAdvance,
} from './dailyAtBatResolution';
import {
  DEMO_DAILY_PITCHES,
  DEMO_DAILY_PUZZLE,
  createInitialDemoGameState,
} from './mockDailyPuzzle';

describe('resolveDailyTerminalAtBat', () => {
  it('resolves a correct result through the engine and returns the pending next pitch state', () => {
    const gameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    const result = resolveDailyTerminalAtBat({
      gameState,
      pitch: getFirstDemoPitch(),
      result: {
        kind: 'correct',
        revealedCount: 0,
        outcome: 'HR',
        source: 0,
      },
      currentPitchIndex: 0,
    });

    expect(result).toMatchObject({
      nextPitchIndex: 1,
      score: {
        runs: 1,
        hits: 1,
        outs: 0,
        strikeouts: 0,
        completed: false,
      },
      pitchLines: [{ initials: 'KGJ', outcome: 'HR' }],
    });
  });

  it('resolves a strikeout result through the engine and increments outs and strikeouts', () => {
    const gameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    const result = resolveDailyTerminalAtBat({
      gameState,
      pitch: getFirstDemoPitch(),
      result: {
        kind: 'strikeout',
        revealedCount: 0,
        strikeCount: 3,
        outcome: 'K',
        source: 'strikeout',
      },
      currentPitchIndex: 0,
    });

    expect(result).toMatchObject({
      nextPitchIndex: 1,
      score: {
        runs: 0,
        hits: 0,
        outs: 1,
        strikeouts: 1,
        completed: false,
      },
      pitchLines: [{ initials: 'KGJ', outcome: 'K' }],
    });
  });

  it('marks the score complete after the third strikeout', () => {
    const gameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    const withTwoOuts: DailyGameState = {
      ...gameState,
      inning: {
        ...gameState.inning,
        outs: 2,
      },
      score: {
        ...gameState.score,
        outs: 2,
        strikeouts: 2,
      },
    };
    const result = resolveDailyTerminalAtBat({
      gameState: withTwoOuts,
      pitch: getFirstDemoPitch(),
      result: {
        kind: 'strikeout',
        revealedCount: 0,
        strikeCount: 3,
        outcome: 'K',
        source: 'strikeout',
      },
      currentPitchIndex: 0,
    });

    expect(result.score).toMatchObject({
      outs: 3,
      strikeouts: 3,
      completed: true,
    });
  });

  it('preserves hitter reveal data while resolving the at-bat', () => {
    const reveal = buildReveal('hitter');
    const pendingAdvance: PendingAtBatAdvance = resolveDailyTerminalAtBat({
      gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
      pitch: getFirstDemoPitch(),
      result: {
        kind: 'correct',
        revealedCount: 0,
        outcome: 'HR',
        source: 0,
      },
      currentPitchIndex: 0,
    });

    expect(reveal.displayName).toBe('Ken Griffey Jr.');
    expect(reveal.career.lines[0]?.stats.HR).toBe(630);
    expect(pendingAdvance.pitchLines).toEqual([{ initials: 'KGJ', outcome: 'HR' }]);
  });

  it('preserves pitcher reveal data while resolving the at-bat', () => {
    const reveal = buildReveal('pitcher');
    const pendingAdvance: PendingAtBatAdvance = resolveDailyTerminalAtBat({
      gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
      pitch: getFirstDemoPitch(),
      result: {
        kind: 'strikeout',
        revealedCount: 0,
        strikeCount: 3,
        outcome: 'K',
        source: 'strikeout',
      },
      currentPitchIndex: 0,
    });

    expect(reveal.displayName).toBe('CC Sabathia');
    expect(reveal.career.lines[0]?.stats.K).toBe(3093);
    expect(pendingAdvance.pitchLines).toEqual([{ initials: 'KGJ', outcome: 'K' }]);
  });
});

function getFirstDemoPitch() {
  const pitch = DEMO_DAILY_PITCHES[0];

  if (pitch === undefined) {
    throw new Error('Expected at least one demo Daily pitch.');
  }

  return pitch;
}

function buildReveal(kind: 'hitter' | 'pitcher'): CanonicalRevealViewModel {
  const hitterStats = {
    AB: 9801,
    H: 2781,
    HR: 630,
    BA: '.284',
    R: 1662,
    RBI: 1836,
    SB: 184,
    OBP: '.370',
    SLG: '.538',
    OPS: '.908',
  };
  const pitcherStats = {
    W: 251,
    L: 161,
    SV: 0,
    ERA: '3.74',
    WHIP: '1.26',
    K: 3093,
    IP: '3577.1',
  };
  return {
    playerId: kind === 'hitter' ? 'ibp_griffey' : 'ibp_sabathia',
    displayName: kind === 'hitter' ? 'Ken Griffey Jr.' : 'CC Sabathia',
    playerType: kind,
    primaryPosition: kind === 'hitter' ? 'CF' : 'P',
    yearsPlayedDisplay: kind === 'hitter' ? '1989–2010' : '2001–2019',
    teamIds: kind === 'hitter' ? ['SEA', 'CIN', 'CHA'] : ['CLE', 'MIL', 'NYA'],
    career: {
      lines: [{ kind, stats: kind === 'hitter' ? hitterStats : pitcherStats }],
    },
    seasons: [],
  };
}
