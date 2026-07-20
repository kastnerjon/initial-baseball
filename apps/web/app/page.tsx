import type { JSX } from 'react';
import { DailyInningGame } from './components/DailyInningGame';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { dailyRuntime } from './serverCanonicalRuntime';

export const revalidate = 60;

export default function DailyInningHomePage(): JSX.Element {
  const bootstrap = dailyRuntime.getBootstrap(getPacificDailyDateString());

  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Daily Inning by Initial Baseball</p>
        <h1>{`Daily Inning #${bootstrap.puzzle.puzzleNumber}`}</h1>
        <section className="daily-instructions" aria-label="How to play">
          <p>
            Guess the player from initials. Reveal hints if stuck; earlier correct guesses score better outcomes.
            Give up records a strikeout. Come back daily after midnight Pacific.
          </p>
        </section>
        <DailyInningGame
          puzzle={bootstrap.puzzle}
          initialProgressionToken={bootstrap.progressionToken}
        />
      </section>
    </main>
  );
}
