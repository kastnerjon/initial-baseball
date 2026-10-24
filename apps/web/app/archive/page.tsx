import type { JSX } from 'react';
import { listAvailableArchiveBetaPuzzles } from '../serverArchiveBetaRuntime';
import { ArchiveLocalResults } from './ArchiveLocalResults';

export const dynamic = 'force-dynamic';

export default async function ArchivePage(): Promise<JSX.Element> {
  const puzzles = await listAvailableArchiveBetaPuzzles();
  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Initial Baseball · Archive beta</p>
        <h1>Play an earlier lineup</h1>
        <p>Frozen puzzles, current Daily Nine scoring. Your progress and scores are saved on this device, separately from today’s game.</p>
        <p>This test archive is disposable and is not the permanent Daily sequence. Comparisons use other submitted results for each exact puzzle and ruleset.</p>
        <a href="/">Back to today’s Daily</a> · <a href="/results">My Results</a>
        {puzzles.length === 0 ? <p>No archive puzzles have been issued yet.</p> : (
          <ArchiveLocalResults puzzles={puzzles.map(puzzle => ({
            dailyNumber: puzzle.dailyNumber, puzzleDate: puzzle.puzzleDate,
          }))} />
        )}
        <p>Showing up to 60 most recent issued puzzles.</p>
      </section>
    </main>
  );
}
