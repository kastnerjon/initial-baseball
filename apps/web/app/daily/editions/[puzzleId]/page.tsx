import React, { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { isOfficialDailyArchiveVisible } from '../../../serverOfficialDailyArchiveSection';
import { isOfficialDailyOccurrenceId, validateIssuedDailyCalendarDate } from '@initial-baseball/daily/official-edition-identity';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { validateOfficialDailyEditionBootstrap } from '../../../officialDailyEditionHttpTransport';
import { createServerOfficialDailyEditionRuntime } from '../../../serverOfficialDailyEditionRuntime';
import {
  isOfficialDailyEditionChooserVisible, isOfficialDailyEditionCompetitiveVisible,
  isOfficialDailyEditionPracticeVisible,
} from '../../../serverOfficialDailyEditionChoice';
import { CompetitiveDailyGame } from '../../../components/CompetitiveDailyGame';
import { DailyInningGame } from '../../../components/DailyInningGame';
import { DailyHowToDialog } from '../../../components/DailyHowToDialog';
import { getDailyHowToContent } from '../../../dailyHowTo';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Daily Nine | Initial Baseball',
  description: 'An unlisted published official Daily Nine puzzle.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

/**
 * Released exact-edition shared Daily game. Scored play and practice share
 * strict server-side release gates; both remain default OFF in production.
 */
export default async function OfficialDailyPracticePage({
  params, searchParams,
}: {
  params: Promise<{ puzzleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  if (!isOfficialDailyEditionPracticeVisible()) notFound();
  const { puzzleId } = await params;
  const query = await searchParams;
  if (typeof puzzleId !== 'string' || !puzzleId.startsWith('daily-ed-v1-')
      || !isOfficialDailyOccurrenceId(puzzleId.slice('daily-ed-v1-'.length))
      || Object.keys(query).length !== 1 || typeof query.date !== 'string') {
    notFound();
  }
  const date = query.date;
  try { validateIssuedDailyCalendarDate(date); } catch { notFound(); }

  const competitivePreview = isOfficialDailyEditionCompetitiveVisible();
  let bootstrap = null;
  if (!competitivePreview) {
    try {
      bootstrap = validateOfficialDailyEditionBootstrap(
        await createServerOfficialDailyEditionRuntime(puzzleId).getBootstrap(date), puzzleId, date,
      );
    } catch (error) {
      if (error instanceof DailyRuntimeRequestError) notFound();
      throw error;
    }
  }
  const ruleset = bootstrap?.rulesetVersion ?? 'points-v4';
  return (
    <main className="page-shell">
      <section className="daily-card">
        <header className="daily-masthead">
          <div>
            <p className="eyebrow">Initial Baseball · Official Daily</p>
            <h1>Daily Nine</h1>
            <p className="daily-deck">{date} · {competitivePreview ? 'Competitive Daily' : 'Practice — scores are not submitted'}</p>
          </div>
          <DailyHowToDialog
            key={`${puzzleId}:${ruleset}`}
            content={getDailyHowToContent(ruleset)}
          />
        </header>
        <nav aria-label="Daily navigation">
          <a href="/">Today’s Daily</a>
          {' · '}<a href="/archive">{isOfficialDailyArchiveVisible() ? 'Official Archive' : 'Archive beta'}</a>
          {isOfficialDailyEditionChooserVisible() ? (
            <>{' · '}<a href="/daily/editions">More official Daily puzzles</a></>
          ) : null}
        </nav>
        {bootstrap === null ? <CompetitiveDailyGame key={puzzleId + date} puzzleId={puzzleId} date={date} />
          : <DailyInningGame key={bootstrap.puzzle.id}
          puzzle={bootstrap.puzzle} rulesetVersion={bootstrap.rulesetVersion}
          initialProgressionToken={bootstrap.progressionToken}
          initialHintBundle={bootstrap.hintBundle}
          archivePath={`/daily/editions/${puzzleId}?date=${date}`}
          officialEditionPractice
        />}
      </section>
    </main>
  );
}
