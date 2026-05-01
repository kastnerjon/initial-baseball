import type { JSX } from 'react';
import { baseballPlayers } from '@initial-baseball/baseball-data';
import { DailyInningGame } from './components/DailyInningGame';
import { createDailyPuzzleForDate } from './createDailyPuzzleForDate';
import { createGamePitchesFromPuzzle } from './mockDailyPuzzle';

export default function DailyInningHomePage(): JSX.Element {
  const puzzle = createDailyPuzzleForDate(getTodayDateString());
  const pitches = createGamePitchesFromPuzzle(puzzle);

  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Daily Inning by Initial Baseball</p>
        <h1>{`Daily Inning #${puzzle.puzzleNumber}`}</h1>
        <DailyInningGame puzzle={puzzle} demoPitches={pitches} players={baseballPlayers} />
      </section>
    </main>
  );
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
