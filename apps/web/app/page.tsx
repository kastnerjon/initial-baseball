import type { JSX } from 'react';
import { DailyInningGame } from './components/DailyInningGame';
import { DEMO_DAILY_PITCHES, DEMO_DAILY_PUZZLE, DEMO_PLAYERS } from './mockDailyPuzzle';

export default function DailyInningHomePage(): JSX.Element {
  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Daily Inning by Initial Baseball</p>
        <h1>{`Daily Inning #${DEMO_DAILY_PUZZLE.puzzleNumber}`}</h1>
        <DailyInningGame puzzle={DEMO_DAILY_PUZZLE} demoPitches={DEMO_DAILY_PITCHES} players={DEMO_PLAYERS} />
      </section>
    </main>
  );
}
