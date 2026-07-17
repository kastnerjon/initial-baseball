import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { baseballPlayers } from '@initial-baseball/baseball-data';
import { createDailyShareResult, formatDailyShareText, getGuessOutcome } from '@initial-baseball/engine';
import type { DailyGameState, DailyGuessResult } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import { AtBatCard } from './components/AtBatCard';
import { PlayerRevealCard } from './components/PlayerRevealCard';
import { createGiveUpResult, resolveDailyTerminalAtBat } from './dailyAtBatResolution';
import { createDailyShareUrl } from './dailyShareUrl';
import {
  DEMO_DAILY_PITCHES,
  DEMO_DAILY_PUZZLE,
  createInitialAtBatUiState,
  createInitialDemoGameState,
} from './mockDailyPuzzle';

const firstPitch = getFirstDemoPitch();
const firstRevealPlayer = getFirstRevealPlayer();
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
  it('increments outs and does not add a hit for Give Up', () => {
    const advance = resolveDailyTerminalAtBat({
      gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
      pitch: firstPitch,
      result: createGiveUpResult(0, 3),
      currentPitchIndex: 0,
    });

    expect(advance.score.outs).toBe(1);
    expect(advance.score.hits).toBe(0);
    expect(advance.pitchLines).toEqual([{ initials: firstPitch.player.initials, outcome: 'K' }]);
  });

  it('keeps normal correct-guess scoring unchanged', () => {
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
      currentPitchIndex: 0,
    });

    expect(advance.score.runs).toBe(1);
    expect(advance.score.hits).toBe(1);
    expect(advance.score.outs).toBe(0);
    expect(advance.pitchLines).toEqual([{ initials: firstPitch.player.initials, outcome: 'HR' }]);
  });

  it('keeps share output to initials and outcome after Give Up', () => {
    const initialGameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    const advance = resolveDailyTerminalAtBat({
      gameState: initialGameState,
      pitch: firstPitch,
      result: createGiveUpResult(0, 3),
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
      completedPitchLines: advance.pitchLines,
    };
    const shareText = formatDailyShareText(createDailyShareResult({
      gameState,
      url: createDailyShareUrl(),
    }));

    expect(shareText).toContain(`Daily Inning #${DEMO_DAILY_PUZZLE.puzzleNumber}`);
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

    expect(html).toContain(`At Bat ${firstPitch.pitchNumber}`);
    expect(html).not.toContain(`Pitch ${firstPitch.pitchNumber}`);
    expect(html).toContain('Give up');
    expect(html).toContain('Guess the player');
  });

  it('reveals the correct answer after Give Up and waits for the next at-bat', () => {
    const html = renderAtBatCard({
      submittedResult: createGiveUpResult(0, 3),
      strikeCount: 3,
    });

    expect(html).toContain(`At Bat ${firstPitch.pitchNumber}`);
    expect(html).toContain('Next At Bat');
    expect(html).not.toContain('Next Pitch');
    expect(html).toContain('K');
    expect(html).toContain('Player Reveal');
    expect(html).toContain(firstPitch.player.fullName);
    expect(html).toContain(`${firstRevealPlayer.yearsPlayedDisplay} · Hitter · ${firstRevealPlayer.primaryPosition} · ${firstRevealPlayer.primaryTeam}`);
    expect(html).toContain('<th scope="col">Summary</th>');
    expect(html).toContain('<th scope="col">OPS</th>');
    expect(html).toContain('<td>630</td>');
    expect(html).toContain('Outcome distribution will appear once public results are collected.');
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

    expect(html).toContain('Strikeout');
    expect(html).toContain('Player Reveal');
    expect(html).toContain(firstPitch.player.fullName);
  });

  it('reveals the player card after a correct outcome', () => {
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

    expect(html).toContain('Player Reveal');
    expect(html).toContain(firstPitch.player.fullName);
    expect(html).toContain(firstRevealPlayer.yearsPlayedDisplay);
    expect(html).toContain('Career');
    expect(html).not.toContain(`Answer: ${firstPitch.player.fullName}`);
  });
});

describe('PlayerRevealCard', () => {
  it('renders years played and hitter stat strip labels and values', () => {
    const kenGriffeyJr = requirePlayerByName('Ken Griffey Jr.');
    const html = renderToStaticMarkup(React.createElement(PlayerRevealCard, { player: kenGriffeyJr }));

    expect(html).toContain('1989–2010');
    expect(html).toContain('<th scope="col">Summary</th>');
    expect(html).toContain('<th scope="col">AB</th>');
    expect(html).toContain('<th scope="col">OPS</th>');
    expect(html).toContain('<th scope="row">Career</th>');
    expect(html).toContain('<td>630</td>');
    expect(html).toContain('<td>.908</td>');
  });

  it('renders pitcher stat strip labels and values', () => {
    const ccSabathia = requirePlayerByName('CC Sabathia');
    const html = renderToStaticMarkup(React.createElement(PlayerRevealCard, { player: ccSabathia }));

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
}: {
  submittedResult: DailyGuessResult | null;
  strikeCount: number;
}): string {
  return renderToStaticMarkup(
    React.createElement(AtBatCard, {
      atBat: firstPitch,
      players: baseballPlayers,
      state: {
        ...createInitialAtBatUiState(),
        strikeCount,
        submittedResult,
      },
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

function getFirstRevealPlayer() {
  const player = baseballPlayers.find((candidate) => candidate.id === firstPitch.correctPlayerId);

  if (player === undefined) {
    throw new Error('Expected first Daily pitch player to exist in generated player data.');
  }

  return player;
}

function requirePlayerByName(name: string) {
  const player = baseballPlayers.find((candidate) => (
    candidate.fullName === name
    || candidate.displayName === name
    || candidate.aliases.includes(name)
  ));

  if (player === undefined) {
    throw new Error(`Expected ${name} to exist in generated player data.`);
  }

  return player;
}
