import React, { type JSX } from 'react';
import { notFound } from 'next/navigation';
import {
  isOfficialDailyEditionChooserVisible, readCurrentOfficialDailyEditionChoice,
} from '../../serverOfficialDailyEditionChoice';
import type { OfficialDailyEditionChoicePage } from '../../serverOfficialDailyEditionChoice';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Today’s Daily Puzzles | Initial Baseball',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** A4 read-only choice surface. Main Daily remains the primary and competitive A3 is disabled. */
export default async function OfficialDailyEditionChoicePage({ searchParams }: PageProps): Promise<JSX.Element> {
  if (!isOfficialDailyEditionChooserVisible()) notFound();
  let page: OfficialDailyEditionChoicePage | null = null;
  let unavailable = false;
  try {
    const query = await searchParams;
    page = await readCurrentOfficialDailyEditionChoice({
      afterEdition: query.afterEdition, cursorDate: query.cursorDate,
    });
  } catch {
    unavailable = true;
  }
  return (
    <main className="page-shell">
      <section className="daily-card">
        <p className="eyebrow">Initial Baseball · Daily Nine</p>
        <h1>Today’s Daily puzzles</h1>
        <p>The original Daily Nine remains playable without an account. Additional published editions can be played for practice without an account; competitive scores are not submitted.</p>
        <p><a href="/">Play today’s primary Daily Nine</a></p>
        {unavailable || page === null ? (
          <p role="status">Additional Daily puzzles are temporarily unavailable.
            <a href="/daily/editions">Start from today’s first page</a>
          </p>
        ) : (
          <section aria-label={`Official Daily editions for ${page.puzzleDate}`}>
            <h2>{page.puzzleDate} · More puzzles</h2>
            {page.editions.length === 0 ? <p>No additional editions are available today.</p> : (
              <ul>
                {page.editions.map(edition => (
                  <li key={edition.puzzleId}>
                    <a href={`/daily/editions/${encodeURIComponent(edition.puzzleId)}?date=${encodeURIComponent(page.puzzleDate)}`}>
                      <strong>{edition.title}</strong>
                    </a>
                    {' · Practice only; scores are not submitted'}
                  </li>
                ))}
              </ul>
            )}
            {page.nextCursor === null ? null : (
              <a href={`/daily/editions?afterEdition=${page.nextCursor}&cursorDate=${page.puzzleDate}`}>More official Daily puzzles</a>
            )}
          </section>
        )}
        <p><a href="/archive">Earlier Daily puzzles</a></p>
      </section>
    </main>
  );
}
