import { ARCHIVE_BETA_EPOCH } from '../../archiveBetaActivation';
import { getPacificDailyDateString } from '../../getPacificDailyDateString';
import type { JSX } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DailyAdminAuthorizationError } from '../../dailyAdminAuthorization';
import { createDailyAdminContext } from '../../dailyAdminComposition';
import { isDailyAdminLifecycleAction } from '../../dailyAdminLifecycleActions';
import { DAILY_ADMIN_AUTH_PATH } from '../../dailyAdminPaths';
import { createDailyAdminWorkflow } from '../../dailyAdminWorkflow';
import { DAILY_ADMIN_HISTORY_PAGE_DAYS, getDailyAdminHistoryWindow } from './dailyAdminHistoryWindow';
import {
  DailyAdministrationView,
  type DailyAdminEditorSelection,
} from './DailyAdministrationView';

export const dynamic = 'force-dynamic';

type DailyAdministrationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DailyAdministrationPage({
  searchParams,
}: DailyAdministrationPageProps): Promise<JSX.Element> {
  try {
    const requestHeaders = await headers();
    const { repository } = createDailyAdminContext({
      authorizationHeader: requestHeaders.get('authorization'),
    });
    const workflow = createDailyAdminWorkflow(repository);
    const params = await searchParams;
    const currentDate = getPacificDailyDateString();
    const historyWindow = getDailyAdminHistoryWindow(currentDate, readString(params.historyEnd));
    const [puzzles, todayLineups, historyLineups] = await Promise.all([
      workflow.getHorizon(),
      workflow.getHistory(currentDate, 1),
      workflow.getHistory(historyWindow.endDate, DAILY_ADMIN_HISTORY_PAGE_DAYS),
    ]);
    const selection = resolveSelection(params, puzzles);
    const lifecycleAction = readString(params.lifecycle);

    return (
      <DailyAdministrationView
        betaIssuedDate={/^\d{4}-\d{2}-\d{2}$/.test(readString(params.betaIssued)) ? readString(params.betaIssued) : null}
        archiveBetaStartDate={ARCHIVE_BETA_EPOCH.startDate}
        currentDate={currentDate}
        puzzles={puzzles}
        todayLineup={todayLineups[0]!}
        historyLineups={historyLineups}
        historyWindow={historyWindow}
        selection={selection}
        replacementComplete={readString(params.updated) === '1'}
        lifecycleActionComplete={isDailyAdminLifecycleAction(lifecycleAction) ? lifecycleAction : null}
      />
    );
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      redirect(DAILY_ADMIN_AUTH_PATH);
    }

    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: 24 }}>
        <section style={emptyStyle}>
          <p className="eyebrow">Daily administration</p>
          <h1>Administration unavailable</h1>
          <p>The server-side editorial repository is not ready. Verify the migration and required server-only environment configuration.</p>
        </section>
      </main>
    );
  }
}

function resolveSelection(
  params: Record<string, string | string[] | undefined>,
  puzzles: readonly { puzzleDate: string; selections: readonly { slot: number }[] }[],
): DailyAdminEditorSelection | null {
  const puzzleDate = readString(params.puzzleDate);
  const slot = Number(readString(params.slot));
  if (!Number.isInteger(slot)) return null;
  const puzzle = puzzles.find(candidate => candidate.puzzleDate === puzzleDate);
  return puzzle?.selections.some(candidate => candidate.slot === slot)
    ? { puzzleDate, slot }
    : null;
}

function readString(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

const emptyStyle = {
  border: '1px solid rgba(22, 33, 22, 0.18)',
  borderRadius: 16,
  background: 'rgba(255, 252, 244, 0.96)',
  padding: 20,
  marginTop: 28,
} as const;
