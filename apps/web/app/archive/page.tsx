import type { JSX } from 'react';
import { listAvailableArchiveBetaPuzzles } from '../serverArchiveBetaRuntime';

export const dynamic = 'force-dynamic';

export default async function ArchivePage(): Promise<JSX.Element> {
  const puzzles = await listAvailableArchiveBetaPuzzles();
  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Initial Baseball · Archive beta</p>
        <h1>Play an earlier lineup</h1>
        <p>Frozen puzzles, current Daily Nine scoring. Your progress and scores are saved on this device, separately from today’s game.</p>
        <p>This test archive is disposable and is not the permanent Daily sequence. Averages and hosted archive results are not enabled yet.</p>
        <a href="/">Back to today’s Daily</a>
        {puzzles.length === 0 ? <p>No archive puzzles have been issued yet.</p> : (
          <ul aria-label="Issued archive puzzles">
            {puzzles.map(puzzle => <li key={puzzle.dailyNumber} style={{ padding: '12px 0' }}>
              <a href={`/archive/${puzzle.dailyNumber}`}>Archive beta #{puzzle.dailyNumber} · {puzzle.puzzleDate}</a>
            </li>)}
          </ul>
        )}
        <p>Showing up to 60 most recent issued puzzles.</p>
      </section>
    </main>
  );
}
