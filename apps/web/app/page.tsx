import type { JSX } from 'react';
import { DailyInningGame } from './components/DailyInningGame';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { dailyRuntime } from './serverCanonicalRuntime';

export const revalidate = 60;

export default async function DailyInningHomePage(): Promise<JSX.Element> {
  const bootstrap = await dailyRuntime.getBootstrap(getPacificDailyDateString());
  return (
    <main className="page-shell">
      <section className="daily-card">
        <header className="daily-masthead">
          <div className="daily-brand-lockup">
            <span className="daily-brand-mark" aria-hidden="true">IB</span>
            <div>
              <p className="eyebrow">Initial Baseball</p>
              <h1>Daily Inning</h1>
              <p className="daily-deck">Guess today&apos;s lineup from initials.</p>
            </div>
          </div>
          <div className="daily-header-tools">
            <span className="daily-edition" aria-label={`Daily Inning number ${bootstrap.puzzle.puzzleNumber}`}>
              {`Daily #${bootstrap.puzzle.puzzleNumber}`}
            </span>
            <details className="daily-instructions">
              <summary>How to play</summary>
              <p>Guess the player from initials. Reveal hints if stuck; earlier correct guesses score better outcomes. Three wrong guesses or Give Up records a strikeout. A new Daily Inning arrives after midnight Pacific.</p>
            </details>
          </div>
        </header>

        <DailyInningGame
          puzzle={bootstrap.puzzle}
          initialProgressionToken={bootstrap.progressionToken}
          initialHintBundle={bootstrap.hintBundle}
        />

        <footer className="daily-footer">
          <span>One lineup every day.</span>
          <span>New puzzle · Midnight Pacific</span>
        </footer>
      </section>
    </main>
  );
}
