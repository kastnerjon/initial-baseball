import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDailyShareResult, formatDailyShareText, getGuessOutcome } from '@initial-baseball/engine';
import {
  CURRENT_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  type DailyGameState,
  type DailyGuessResult,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import { DailyScorebug } from './components/DailyScorebug';
import { AtBatCard } from './components/AtBatCard';
import { PlayerRevealCard } from './components/PlayerRevealCard';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';
import { createGiveUpResult, resolveDailyTerminalAtBat } from './dailyAtBatResolution';
import { createDailyShareUrl } from './dailyShareUrl';
import {
  DEMO_DAILY_PITCHES,
  DEMO_DAILY_PUZZLE,
  createInitialAtBatUiState,
  createInitialDemoGameState,
} from './mockDailyPuzzle';

const firstPitch = getFirstDemoPitch();
const firstReveal = buildReveal('hitter');
(globalThis as Record<string, unknown>).React = React;

describe('createGiveUpResult', () => {
  it('resolves Give Up as a strikeout', () => {
    expect(createGiveUpResult(2, 3)).toEqual({
      kind: 'strikeout',
      revealedCount: 2,
      strikeCount: 3,
      outcome: 'K',
      source: 'strikeout',
    });
  });
});

describe('resolveDailyTerminalAtBat', () => {
  it('records Give Up as a zero-point raw at-bat fact without ending points-v2', () => {
    const advance = resolveDailyTerminalAtBat({
      gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
      pitch: firstPitch,
      result: createGiveUpResult(0, 3),
      resolution: 'give_up',
      wrongGuesses: 0,
      currentPitchIndex: 0,
    });

    expect(advance.score.outs).toBe(1);
    expect(advance.score.hits).toBe(0);
    expect(advance.score.completed).toBe(false);
    expect(advance.points).toMatchObject({ points: 0, maximumPoints: 24, atBatsCompleted: 1, completed: false });
    expect(advance.completedAtBats).toEqual([{
      pitchNumber: firstPitch.pitchNumber,
      initials: firstPitch.player.initials,
      outcome: 'K',
      hintsRevealed: 0,
      wrongGuesses: 0,
      resolution: 'give_up',
    }]);
    expect(advance.pitchLines).toEqual([{ initials: firstPitch.player.initials, outcome: 'K' }]);
  });

  it('awards four points for an initials-only correct guess', () => {
    const correctResult = getGuessOutcome({
      isCorrect: true,
      revealCount: 0,
      strikeCount: 0,
      maxStrikes: 3,
    });

    if (correctResult.kind !== 'correct') {
      throw new Error('Expected a correct result.');
    }

    const advance = resolveDailyTerminalAtBat({
      gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
      pitch: firstPitch,
      result: correctResult,
      resolution: 'correct',
      wrongGuesses: 0,
      currentPitchIndex: 0,
    });

    expect(advance.score.runs).toBe(1);
    expect(advance.score.hits).toBe(1);
    expect(advance.score.outs).toBe(0);
    expect(advance.points.points).toBe(4);
    expect(advance.completedAtBats[0]).toMatchObject({
      outcome: 'HR',
      hintsRevealed: 0,
      wrongGuesses: 0,
      resolution: 'correct',
    });
    expect(advance.pitchLines).toEqual([{ initials: firstPitch.player.initials, outcome: 'HR' }]);
  });

  it('keeps share output to initials, outcomes, and spoiler-safe point totals', () => {
    const initialGameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    const advance = resolveDailyTerminalAtBat({
      gameState: initialGameState,
      pitch: firstPitch,
      result: createGiveUpResult(0, 3),
      resolution: 'give_up',
      wrongGuesses: 0,
      currentPitchIndex: 0,
    });
    const gameState: DailyGameState = {
      ...initialGameState,
      status: 'completed',
      inning: advance.inning,
      score: {
        ...advance.score,
        completed: true,
      },
      points: {
        ...advance.points,
        completed: true,
      },
      completedAtBats: advance.completedAtBats,
      completedPitchLines: advance.pitchLines,
    };
    const shareText = formatDailyShareText(createDailyShareResult({
      gameState,
      url: createDailyShareUrl(),
    }));

    expect(shareText).toContain(`Daily Inning #${DEMO_DAILY_PUZZLE.puzzleNumber}`);
    expect(shareText).toContain('0/24 PTS');
    expect(shareText).toContain(`${firstPitch.player.initials}: K`);
    expect(shareText).not.toContain(firstPitch.player.fullName);
    expect(shareText).not.toContain('initialbaseball.com');
  });
});

describe('AtBatCard terminal output', () => {
  it('renders At Bat language and a Give up action while active', () => {
    const html = renderAtBatCard({
      submittedResult: null,
      strikeCount: 0,
    });

    expect(html).toContain('Who is the player?');
    expect(html).not.toContain(`Pitch ${firstPitch.pitchNumber}`);
    expect(html).toContain('Give up');
    expect(html).toContain('Guess the player');
  });

  it('reveals the correct answer and zero points after Give Up', () => {
    const html = renderAtBatCard({
      submittedResult: createGiveUpResult(0, 3),
      strikeCount: 3,
    });

    expect(html).toContain(`At Bat ${firstPitch.pitchNumber}`);
    expect(html).toContain('Next At Bat');
    expect(html.indexOf('Next At Bat')).toBeLessThan(html.indexOf('Player Reveal'));
    expect(html).not.toContain('Next Pitch');
    expect(html).toContain('K');
    expect(html).toContain('Strikeout · 0 points');
    expect(html).toContain('Player Reveal');
    expect(html).toContain(firstReveal.displayName);
    expect(html).toContain(`${firstReveal.yearsPlayedDisplay} · Hitter · ${firstReveal.primaryPosition}`);
    expect(html).toContain('<th scope="col">Summary</th>');
    expect(html).toContain('<th scope="col"><abbr title="On-base plus slugging">OPS</abbr></th>');
    expect(html).toContain('<td>630</td>');
    expect(html).not.toContain('Outcome distribution will appear once public results are collected.');
  });

  it('reveals the correct answer after a normal strikeout', () => {
    const strikeoutResult: DailyGuessResult = {
      kind: 'strikeout',
      revealedCount: 1,
      strikeCount: 3,
      outcome: 'K',
      source: 'strikeout',
    };
    const html = renderAtBatCard({
      submittedResult: strikeoutResult,
      strikeCount: 3,
    });

    expect(html).toContain('Strikeout · 0 points');
    expect(html).toContain('Player Reveal');
    expect(html).toContain(firstReveal.displayName);
  });

  it('shows both a correct baseball outcome and awarded points', () => {
    const correctResult = getGuessOutcome({
      isCorrect: true,
      revealCount: 1,
      strikeCount: 0,
      maxStrikes: 3,
    });

    if (correctResult.kind !== 'correct') {
      throw new Error('Expected a correct result.');
    }

    const html = renderAtBatCard({
      submittedResult: correctResult,
      strikeCount: 0,
    });

    expect(html).toContain('3B');
    expect(html).toContain('3 points');
    expect(html).toContain('Player Reveal');
    expect(html).toContain(firstReveal.displayName);
    expect(html).toContain(firstReveal.yearsPlayedDisplay);
    expect(html).toContain('Career');
    expect(html).not.toContain(`Answer: ${firstPitch.player.fullName}`);
  });

  it('preserves outcome-only result copy for legacy inning games', () => {
    const correctResult = getGuessOutcome({
      isCorrect: true,
      revealCount: 0,
      strikeCount: 0,
      maxStrikes: 3,
    });
    if (correctResult.kind !== 'correct') {
      throw new Error('Expected a correct result.');
    }

    const correctHtml = renderAtBatCard({
      submittedResult: correctResult,
      strikeCount: 0,
      rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
    });
    const strikeoutHtml = renderAtBatCard({
      submittedResult: createGiveUpResult(0, 3),
      strikeCount: 3,
      rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
    });

    expect(correctHtml).toContain('HR');
    expect(correctHtml).not.toContain('points');
    expect(strikeoutHtml).toContain('Strikeout');
    expect(strikeoutHtml).not.toContain('0 points');
  });
});

describe('PlayerRevealCard', () => {
  it('renders years played and hitter stat strip labels and values', () => {
    const html = renderToStaticMarkup(React.createElement(PlayerRevealCard, { reveal: firstReveal }));

    expect(html).toContain('1989–2010');
    expect(html).toContain('<th scope="col">Summary</th>');
    expect(html).toContain('<th scope="col"><abbr title="At bats">AB</abbr></th>');
    expect(html).toContain('<th scope="col"><abbr title="On-base plus slugging">OPS</abbr></th>');
    expect(html).toContain('<th scope="row">Career</th>');
    expect(html).toContain('<td>630</td>');
    expect(html).toContain('<td>.908</td>');
  });

  it('separates Season and Team, retains every team, and distinguishes zero from unavailable', () => {
    const reveal = buildReveal('hitter');
    reveal.seasons = [{
      season: 2008, teamIds: ['TOR', 'OAK'],
      lines: [{ kind: 'hitter', stats: { HR: 0, BA: '—' } }],
    }];
    const html = renderToStaticMarkup(React.createElement(PlayerRevealCard, { reveal }));
    expect(html).toContain('<th scope="col">Season</th>');
    expect(html).toContain('<th scope="col" class="stat-team">Team</th>');
    expect(html).toContain('<th scope="row">2008</th><td class="stat-team">TOR, OAK</td>');
    expect(html).toContain('<td>0</td><td>—</td>');
    expect(html).toContain('role="region" aria-label="Season-by-season batting statistics" tabindex="0"');
    expect(html).toContain('<caption class="sr-only">Season-by-season batting statistics</caption>');
  });

  it('renders both batting and pitching tables for two-way players', () => {
    const reveal = buildReveal('hitter');
    reveal.playerType = 'two-way';
    reveal.career.lines.push(...buildReveal('pitcher').career.lines);
    const html = renderToStaticMarkup(React.createElement(PlayerRevealCard, { reveal }));
    expect(html).toContain('Career batting summary');
    expect(html).toContain('Career pitching summary');
    expect(html).toContain('<h3>Batting</h3>');
    expect(html).toContain('<h3>Pitching</h3>');
  });

  it('renders pitcher stat strip labels and values', () => {
    const html = renderToStaticMarkup(React.createElement(PlayerRevealCard, { reveal: buildReveal('pitcher') }));

    expect(html).toContain('2001–2019');
    expect(html).toContain('<th scope="col"><abbr title="Earned run average">ERA</abbr></th>');
    expect(html).toContain('<th scope="col"><abbr title="Walks and hits per inning pitched">WHIP</abbr></th>');
    expect(html).toContain('<th scope="col"><abbr title="Innings pitched">IP</abbr></th>');
    expect(html).toContain('<td>251</td>');
    expect(html).toContain('<td>3093</td>');
  });
});

describe('compact Daily status', () => {
  it.each(['points-v2', 'points-v1', 'legacy-inning-v1'] as const)('keeps %s status explicit without duplicating current strikes', (rulesetVersion) => {
    const game = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    const html = renderToStaticMarkup(React.createElement(DailyScorebug, {
      currentAtBat: 2, totalAtBats: 9, rulesetVersion,
      summary: game.score,
      points: { ...game.points, points: 2, maximumPoints: rulesetVersion === 'points-v1' ? 45 : 36 },
      bases: game.inning.bases,
    }));
    expect(html).toContain('At bat 2 of 9');
    expect(html).not.toContain('>Strikes<');
    expect(html).not.toContain('>AB<');
    if (rulesetVersion === 'legacy-inning-v1') {
      expect(html).not.toContain('>Points<');
      expect(html).toContain('Base occupancy');
      expect(html).toContain('Outs');
    } else {
      expect(html).toContain(rulesetVersion === 'points-v1' ? '2/45' : '2/36');
    }
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
