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
              <p>Each at-bat is worth up to 7 points. Every hint or wrong guess costs 1 point. Three wrong guesses—or Give Up—score 0 points. Play all 9 at-bats for up to 63 points.</p>
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
