import type { JSX } from 'react';
import { DailyInningGame } from './components/DailyInningGame';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { dailyRuntime } from './serverCanonicalRuntime';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

export default async function DailyInningHomePage(): Promise<JSX.Element> {
  const session = await dailyRuntime.getPublicSession(getPacificDailyDateString());

  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Daily Inning by Initial Baseball</p>
        <h1>{`Daily Inning #${session.puzzle.puzzleNumber}`}</h1>
        <section className="daily-instructions" aria-label="How to play">
          <p>
            Guess the player from initials. Reveal hints if stuck; earlier correct guesses score better outcomes.
            Give up records a strikeout. Come back daily after midnight Pacific.
          </p>
        </section>
        <DailyInningGame
          puzzle={session.puzzle}
          initialProgressionToken={session.progressionToken}
        />
      </section>
    </main>
  );
}
