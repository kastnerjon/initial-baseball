import { notFound } from 'next/navigation';
import { CURRENT_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { createServerArchiveBetaRuntime, getAvailableArchiveBetaIdentity } from '../../serverArchiveBetaRuntime';
import { DailyRuntimeRequestError } from '../../dailyRuntimeService';
import { DailyInningGame } from '../../components/DailyInningGame';
import { DailyHowToDialog } from '../../components/DailyHowToDialog';
import { getDailyHowToContent } from '../../dailyHowTo';

export const dynamic = 'force-dynamic';

export default async function ArchivePuzzlePage({ params }: { params: Promise<{ dailyNumber: string }> }): Promise<JSX.Element> {
  const { dailyNumber } = await params;
  const identity = /^[1-9]\d{0,5}$/.test(dailyNumber) ? getAvailableArchiveBetaIdentity(Number(dailyNumber)) : null;
  if (identity === null) notFound();
  let bootstrap;
  try { bootstrap = await createServerArchiveBetaRuntime().getBootstrap(identity.puzzleDate, CURRENT_DAILY_RULESET_VERSION); }
  catch (error) { if (error instanceof DailyRuntimeRequestError) notFound(); throw error; }
  return (
    <main className="page-shell">
      <section className="daily-card">
        <header className="daily-masthead">
          <div><p className="eyebrow">Initial Baseball · Archive beta</p><h1>Daily Nine</h1><p>{identity.puzzleDate} · Archive beta #{identity.dailyNumber}</p></div>
          <DailyHowToDialog key={`${bootstrap.puzzle.id}:${bootstrap.rulesetVersion}`} content={getDailyHowToContent(bootstrap.rulesetVersion)} />
        </header>
        <nav aria-label="Archive navigation"><a href="/archive">All archive puzzles</a> · <a href="/">Today’s Daily</a></nav>
        <p>Progress is saved separately on this device. Archive averages are not enabled yet.</p>
        <DailyInningGame key={bootstrap.puzzle.id} puzzle={bootstrap.puzzle} rulesetVersion={bootstrap.rulesetVersion}
          initialProgressionToken={bootstrap.progressionToken} initialHintBundle={bootstrap.hintBundle} archivePath={`/archive/${identity.dailyNumber}`} />
      </section>
    </main>
  );
}
