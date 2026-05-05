import type { JSX } from 'react';
import { baseballPlayers } from '@initial-baseball/baseball-data';
import { DailyInningGame } from './components/DailyInningGame';
import { createDailyPuzzleForDate } from './createDailyPuzzleForDate';
import { createGamePitchesFromPuzzle } from './dailyPuzzleAdapters';
import { getPacificDailyDateString } from './getPacificDailyDateString';

export default function DailyInningHomePage(): JSX.Element {
  const puzzle = createDailyPuzzleForDate(getPacificDailyDateString());
  const pitches = createGamePitchesFromPuzzle(puzzle);

  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Daily Inning by Initial Baseball</p>
        <h1>{`Daily Inning #${puzzle.puzzleNumber}`}</h1>
        <section className="daily-instructions" aria-label="How to play">
          <p>
            Guess the player from initials. Reveal hints if stuck; earlier correct guesses score better outcomes.
            Give up records a strikeout. Come back daily after midnight Pacific.
          </p>
        </section>
        <DailyInningGame puzzle={puzzle} demoPitches={pitches} players={baseballPlayers} />
      </section>
    </main>
  );
}
