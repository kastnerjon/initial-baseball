import type { JSX } from 'react';
import { AtBatCard } from './components/AtBatCard';
import { DEMO_PLAYERS, DEMO_SINGLE_AT_BAT } from './mockAtBatData';

export default function DailyInningHomePage(): JSX.Element {
  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Daily Inning by Initial Baseball</p>
        <h1>{`Daily Inning #${DEMO_SINGLE_AT_BAT.puzzleNumber}`}</h1>
        <AtBatCard atBat={DEMO_SINGLE_AT_BAT} players={DEMO_PLAYERS} />
      </section>
    </main>
  );
}
