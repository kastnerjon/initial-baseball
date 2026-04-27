import type { JSX } from 'react';
import { formatDailyShareText } from '@initial-baseball/engine';
import { PitchList } from './components/PitchList';
import { ScoreLine } from './components/ScoreLine';
import { createMockDailyShareResult } from './mockDailyGameState';

export default function DailyInningHomePage(): JSX.Element {
  const shareResult = createMockDailyShareResult();
  const shareText = formatDailyShareText(shareResult);

  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Daily Inning by Initial Baseball</p>
        <h1>{`Daily Inning #${shareResult.puzzleNumber}`}</h1>
        <ScoreLine summary={shareResult.summary} />
        <PitchList pitchLines={shareResult.pitchLines} />
      </section>

      <section className="share-card">
        <h2>Share Text</h2>
        <pre className="share-text">{shareText}</pre>
      </section>
    </main>
  );
}
