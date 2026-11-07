import React, { type JSX } from 'react';
import { listAvailableArchiveBetaPuzzles } from '../serverArchiveBetaRuntime';
import { readPrivateOfficialDailyArchive, isOfficialDailyArchiveVisible } from '../serverOfficialDailyArchiveSection';
import type { OfficialDailyArchivePage } from '../serverOfficialDailyArchiveSection';
import { ArchiveLocalResults } from './ArchiveLocalResults';
import { OfficialEditionArchiveSection } from './OfficialEditionArchiveSection';

export const dynamic = 'force-dynamic';

type ArchivePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Preserve the existing beta archive while staging immutable official editions on the same page. */
export default async function ArchivePage({ searchParams }: ArchivePageProps): Promise<JSX.Element> {
  const puzzles = await listAvailableArchiveBetaPuzzles();
  const officialArchiveEnabled = isOfficialDailyArchiveVisible();
  let official: OfficialDailyArchivePage | null = null;
  let officialUnavailable = false;
  if (officialArchiveEnabled) {
    try {
      official = await readPrivateOfficialDailyArchive(await searchParams);
    } catch {
      // Never reflect service-role errors or a caller's malformed cursor to public HTML.
      officialUnavailable = true;
    }
  }
  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Initial Baseball · {officialArchiveEnabled ? 'Archive' : 'Archive beta'}</p>
        <h1>{officialArchiveEnabled ? 'Past Daily lineups' : 'Play an earlier lineup'}</h1>
        {official !== null ? <OfficialEditionArchiveSection page={official} /> : null}
        {officialUnavailable ? (
          <section aria-label="Official Daily archive">
            <h2>Official Daily editions</h2>
            <p>The official edition list is temporarily unavailable.</p>
          </section>
        ) : null}
        {officialArchiveEnabled ? <h2>Archive beta</h2> : null}
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
