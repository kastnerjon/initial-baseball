import type { JSX } from 'react';
import { DEFAULT_DAILY_HINT_CONFIG } from '@initial-baseball/shared';

export default function DailyInningHomePage(): JSX.Element {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Daily Inning by Initial Baseball</p>
        <h1>Score today&apos;s inning.</h1>
        <p>
          Guess the player from initials. Reveal hints if you need them. Fewer hints mean a better hit.
          Share your line and compare how everyone else did pitch-by-pitch.
        </p>
        <div className="ladder" aria-label="Default Daily Inning hint ladder">
          {DEFAULT_DAILY_HINT_CONFIG.map((slot) => (
            <div key={slot.slot} className="ladder-row">
              <span>{slot.displayLabel}</span>
              <strong>{slot.result.toUpperCase()}</strong>
            </div>
          ))}
        </div>
        <p className="status-note">MVP scaffold: game flow implementation starts after shared engine and player seed work.</p>
      </section>
    </main>
  );
}
