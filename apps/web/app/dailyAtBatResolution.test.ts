import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEMO_DAILY_PITCHES } from '@initial-baseball/baseball-data';
import {
  CURRENT_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  type DailyGameState,
  type DailyGuessResult,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import { AtBatCard } from './components/AtBatCard';
import { PlayerRevealCard } from './components/PlayerRevealCard';
import { ResultDisplay } from './components/ResultDisplay';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';
import { createInitialAtBatUiState, createInitialDailyGameState } from './dailyClientState';
import { resolveDailyTerminalAtBat } from './dailyAtBatResolution';

const firstPitch = getFirstDemoPitch();
const firstReveal = buildReveal('hitter');

function createGameState(rulesetVersion: DailyRulesetVersion): DailyGameState {
  return createInitialDailyGameState({
    id: 'daily-2026-08-01-test',
    puzzleNumber: 97,
    puzzleDate: '2026-08-01',
    status: 'published',
    hintConfig: [],
    statsHintConfig: [],
    pitches: [{ pitchNumber: firstPitch.pitchNumber, initials: firstPitch.player.initials }],
  }, rulesetVersion);
}

describe('resolveDailyTerminalAtBat', () => {
  it('resolves a correct current-ruleset at-bat into point-native raw facts', () => {
    const gameState = createGameState(CURRENT_DAILY_RULESET_VERSION);
    const result: DailyGuessResult = {
      kind: 'correct',
      revealedCount: 1,
      strikeCount: 0,
      outcome: '3B',
      source: 'correct_guess',
    };

    const pending = resolveDailyTerminalAtBat({
      gameState,
      pitch: {
        pitchNumber: firstPitch.pitchNumber,
        player: { initials: firstPitch.player.initials },
      },
      result,
      resolution: 'correct',
      wrongGuesses: 0,
      currentPitchIndex: 0,
    });

    expect(pending.completedAtBats).toEqual([{
      pitchNumber: firstPitch.pitchNumber,
      initials: firstPitch.player.initials,
      outcome: '3B',
      revealedCount: 1,
      wrongGuesses: 0,
      resolution: 'correct',
    }]);
    expect(pending.points.total).toBe(3);
    expect(pending.points.completed).toBe(true);
    expect(pending.score.completed).toBe(false);
  });

  it('preserves wrong guesses when Give Up converts the at-bat to a strikeout', () => {
    const gameState = createGameState(CURRENT_DAILY_RULESET_VERSION);
    const result: DailyGuessResult = {
      kind: 'strikeout',
      revealedCount: 2,
      strikeCount: 3,
      outcome: 'K',
      source: 'strikeout',
    };

    const pending = resolveDailyTerminalAtBat({
      gameState,
      pitch: {
        pitchNumber: firstPitch.pitchNumber,
        player: { initials: firstPitch.player.initials },
      },
      result,
      resolution: 'give_up',
      wrongGuesses: 1,
      currentPitchIndex: 0,
    });

    expect(pending.completedAtBats[0]).toMatchObject({
      outcome: 'K',
      revealedCount: 2,
      wrongGuesses: 1,
      resolution: 'give_up',
    });
    expect(pending.points.total).toBe(0);
  });

  it('keeps legacy scoring native to inning/base advancement', () => {
    const gameState = createGameState(LEGACY_DAILY_RULESET_VERSION);
    const result: DailyGuessResult = {
      kind: 'correct',
      revealedCount: 0,
      strikeCount: 0,
      outcome: 'HR',
      source: 'correct_guess',
    };

    const pending = resolveDailyTerminalAtBat({
      gameState,
      pitch: {
        pitchNumber: firstPitch.pitchNumber,
        player: { initials: firstPitch.player.initials },
      },
      result,
      resolution: 'correct',
      wrongGuesses: 0,
      currentPitchIndex: 0,
    });

    expect(pending.score.runs).toBe(1);
    expect(pending.points.total).toBe(0);
    expect(pending.points.max).toBe(0);
  });
});

describe('resolved at-bat presentation', () => {
  it('renders point value beside a current-ruleset correct outcome', () => {
    const html = renderAtBatCard({
      submittedResult: {
        kind: 'correct',
        revealedCount: 1,
        strikeCount: 0,
        outcome: '3B',
        source: 'correct_guess',
      },
      strikeCount: 0,
    });

    expect(html).toContain('Triple');
    expect(html).toContain('3 pts');
  });

  it('renders 0 points beside a strikeout', () => {
    const html = renderAtBatCard({
      submittedResult: {
        kind: 'strikeout',
        revealedCount: 4,
        strikeCount: 3,
        outcome: 'K',
        source: 'strikeout',
      },
      strikeCount: 3,
    });

    expect(html).toContain('Strikeout');
    expect(html).toContain('0 pts');
  });

  it('keeps point copy absent for legacy results', () => {
    const html = renderAtBatCard({
      submittedResult: {
        kind: 'correct',
        revealedCount: 0,
        strikeCount: 0,
        outcome: 'HR',
        source: 'correct_guess',
      },
      strikeCount: 0,
      rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
    });

    expect(html).toContain('Home Run');
    expect(html).not.toContain('pts');
  });

  it('keeps points-v1 result copy on its compatibility weights', () => {
    const html = renderAtBatCard({
      submittedResult: {
        kind: 'correct',
        revealedCount: 0,
        strikeCount: 0,
        outcome: 'HR',
        source: 'correct_guess',
      },
      strikeCount: 0,
      rulesetVersion: POINTS_V1_DAILY_RULESET_VERSION,
    });

    expect(html).toContain('Home Run');
    expect(html).toContain('5 pts');
  });
});

describe('canonical reveal presentation', () => {
  it('renders the canonical player identity, career summary, and season rows after resolution', () => {
    const html = renderAtBatCard({
      submittedResult: {
        kind: 'correct',
        revealedCount: 0,
        strikeCount: 0,
        outcome: 'HR',
        source: 'correct_guess',
      },
      strikeCount: 0,
    });

    expect(html).toContain('Ken Griffey Jr.');
    expect(html).toContain('1989–2010');
    expect(html).toContain('Career');
    expect(html).toContain('SEA');
  });

  it('renders years played and hitter stat strip labels and values', () => {
    const html = renderToStaticMarkup(React.createElement(PlayerRevealCard, { reveal: firstReveal }));

    expect(html).toContain('1989–2010');
    expect(html).toContain('<th scope="col">Summary</th>');
    expect(html).toContain('<th scope="col">AB</th>');
    expect(html).toContain('<th scope="col">OPS</th>');
    expect(html).toContain('<th scope="row">Career</th>');
    expect(html).toContain('<td>630</td>');
    expect(html).toContain('<td>.908</td>');
  });

  it('renders pitcher stat strip labels and values', () => {
    const html = renderToStaticMarkup(React.createElement(PlayerRevealCard, { reveal: buildReveal('pitcher') }));

    expect(html).toContain('2001–2019');
    expect(html).toContain('<th scope="col">ERA</th>');
    expect(html).toContain('<th scope="col">WHIP</th>');
    expect(html).toContain('<th scope="col">IP</th>');
    expect(html).toContain('<td>251</td>');
    expect(html).toContain('<td>3093</td>');
  });
});

function renderAtBatCard({
  submittedResult,
  strikeCount,
  rulesetVersion = CURRENT_DAILY_RULESET_VERSION,
}: {
  submittedResult: DailyGuessResult | null;
  strikeCount: number;
  rulesetVersion?: DailyRulesetVersion;
}): string {
  return renderToStaticMarkup(
    React.createElement(AtBatCard, {
      atBat: { pitchNumber: firstPitch.pitchNumber, initials: firstPitch.player.initials },
      rulesetVersion,
      state: {
        ...createInitialAtBatUiState(),
        strikeCount,
        submittedResult,
        reveal: submittedResult === null || submittedResult.kind === 'incorrect' ? null : firstReveal,
      },
      requestPending: false,
      giveUpPending: false,
      requestError: null,
      onQueryChange: () => undefined,
      onSelectPlayer: () => undefined,
      onRevealHint: () => undefined,
      onSubmit: () => undefined,
      onGiveUp: () => undefined,
      onNextPitch: () => undefined,
    }),
  );
}

function getFirstDemoPitch() {
  const pitch = DEMO_DAILY_PITCHES[0];

  if (pitch === undefined) {
    throw new Error('Expected at least one demo Daily pitch.');
  }

  return pitch;
}

function buildReveal(kind: 'hitter' | 'pitcher'): CanonicalRevealViewModel {
  return kind === 'hitter'
    ? {
        player: {
          playerId: 'griffke02',
          fullName: 'Ken Griffey Jr.',
          firstName: 'Ken',
          lastName: 'Griffey',
          primaryPosition: 'CF',
          bats: 'L',
          throws: 'L',
          activeStartYear: 1989,
          activeEndYear: 2010,
        },
        career: {
          playerId: 'griffke02',
          role: 'hitter',
          summary: { games: 2671, plateAppearances: 11304, atBats: 9801, hits: 2781, homeRuns: 630, battingAverage: 0.284, onBasePercentage: 0.37, sluggingPercentage: 0.538, ops: 0.908 },
          teams: [{ teamId: 'SEA', games: 1685 }, { teamId: 'CIN', games: 945 }, { teamId: 'CHW', games: 41 }],
        },
        seasons: [
          {
            playerId: 'griffke02',
            season: 1989,
            role: 'hitter',
            teams: ['SEA'],
            summary: { games: 127, plateAppearances: 506, atBats: 455, hits: 120, homeRuns: 16, battingAverage: 0.264, onBasePercentage: 0.329, sluggingPercentage: 0.42, ops: 0.749 },
          },
        ],
      }
    : {
        player: {
          playerId: 'sabacca01',
          fullName: 'CC Sabathia',
          firstName: 'CC',
          lastName: 'Sabathia',
          primaryPosition: 'P',
          bats: 'L',
          throws: 'L',
          activeStartYear: 2001,
          activeEndYear: 2019,
        },
        career: {
          playerId: 'sabacca01',
          role: 'pitcher',
          summary: { games: 561, gamesStarted: 560, wins: 251, losses: 161, earnedRunAverage: 3.74, whip: 1.259, inningsPitched: 3093, strikeouts: 3093, saves: 0 },
          teams: [{ teamId: 'NYY', games: 307 }, { teamId: 'CLE', games: 237 }, { teamId: 'MIL', games: 17 }],
        },
        seasons: [
          {
            playerId: 'sabacca01',
            season: 2001,
            role: 'pitcher',
            teams: ['CLE'],
            summary: { games: 33, gamesStarted: 33, wins: 17, losses: 5, earnedRunAverage: 4.39, whip: 1.353, inningsPitched: 180.1, strikeouts: 171, saves: 0 },
          },
        ],
      };
}
