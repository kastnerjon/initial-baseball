import React, { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { isOfficialDailyOccurrenceId, validateIssuedDailyCalendarDate } from '@initial-baseball/daily/official-edition-identity';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { validateOfficialDailyEditionBootstrap } from '../../../officialDailyEditionHttpTransport';
import { createServerOfficialDailyEditionRuntime } from '../../../serverOfficialDailyEditionRuntime';
import { isOfficialDailyEditionChooserVisible } from '../../../serverOfficialDailyEditionChoice';
import { DailyInningGame } from '../../../components/DailyInningGame';
import { DailyHowToDialog } from '../../../components/DailyHowToDialog';
import { getDailyHowToContent } from '../../../dailyHowTo';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Daily Nine Practice | Initial Baseball',
  description: 'An unlisted official Daily Nine practice puzzle.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

/**
 * Private A2 acceptance route. No competitive attempt or score admission.
 * Three independent server gates default OFF; released puzzles only.
 */
export default async function OfficialDailyPracticePage({
  params, searchParams,
}: {
  params: Promise<{ puzzleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  if (process.env.OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED !== 'true'
      || process.env.OFFICIAL_DAILY_EDITION_HTTP_ENABLED !== 'true'
      || process.env.OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED !== 'true') {
    notFound();
  }
  const { puzzleId } = await params;
  const query = await searchParams;
  if (typeof puzzleId !== 'string' || !puzzleId.startsWith('daily-ed-v1-')
      || !isOfficialDailyOccurrenceId(puzzleId.slice('daily-ed-v1-'.length))
      || Object.keys(query).length !== 1 || typeof query.date !== 'string') {
    notFound();
  }
  const date = query.date;
  try { validateIssuedDailyCalendarDate(date); } catch { notFound(); }

  let bootstrap;
  try {
    bootstrap = validateOfficialDailyEditionBootstrap(
      await createServerOfficialDailyEditionRuntime(puzzleId).getBootstrap(date), puzzleId, date,
    );
  } catch (error) {
    if (error instanceof DailyRuntimeRequestError) notFound();
    throw error;
  }
  return (
    <main className="page-shell">
      <section className="daily-card">
        <header className="daily-masthead">
          <div>
            <p className="eyebrow">Initial Baseball · Official Daily</p>
            <h1>Daily Nine</h1>
            <p className="daily-deck">{date} · Practice — scores are not submitted</p>
          </div>
          <DailyHowToDialog
            key={`${bootstrap.puzzle.id}:${bootstrap.rulesetVersion}`}
            content={getDailyHowToContent(bootstrap.rulesetVersion)}
          />
        </header>
        <nav aria-label="Daily navigation">
          <a href="/">Today’s Daily</a>
          {' · '}<a href="/archive">Archive</a>
          {isOfficialDailyEditionChooserVisible() ? (
            <>{' · '}<a href="/daily/editions">More official Daily puzzles</a></>
          ) : null}
        </nav>
        <DailyInningGame key={bootstrap.puzzle.id}
          puzzle={bootstrap.puzzle} rulesetVersion={bootstrap.rulesetVersion}
          initialProgressionToken={bootstrap.progressionToken}
          initialHintBundle={bootstrap.hintBundle}
          archivePath={`/daily/editions/${puzzleId}?date=${date}`}
          officialEditionPractice
        />
      </section>
    </main>
  );
}
