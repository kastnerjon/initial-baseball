import PrimaryPlayerEditor from './PrimaryPlayerEditor';
import { ArchiveBetaIssuanceForm } from './ArchiveBetaIssuanceForm';
import type { DailyEditorialHorizonPuzzle, DailyEditorialHorizonSlot } from '@initial-baseball/daily';
import React, { type JSX } from 'react';
import type {
  DailyAdminHistoricalLineup,
  DailyAdminLifecycleAction,
} from '../../dailyAdminWorkflow';
import type { DailyAdminHistoryWindow } from './dailyAdminHistoryWindow';
import {
  DailyLifecycleActionForm,
  getDailyLifecycleSuccessMessage,
} from './DailyLifecycleControls';

export type DailyAdminEditorSelection = {
  puzzleDate: string;
  slot: number;
};

type DailyAdministrationViewProps = {
  puzzles: readonly DailyEditorialHorizonPuzzle[];
  selection: DailyAdminEditorSelection | null;
  replacementComplete: boolean;
  lifecycleActionComplete: DailyAdminLifecycleAction | null;
  betaIssuedDate?: string | null;
  archiveBetaStartDate: string;
  currentDate: string;
  todayLineup: DailyAdminHistoricalLineup;
  historyLineups: readonly DailyAdminHistoricalLineup[];
  historyWindow: DailyAdminHistoryWindow;
};

export function DailyAdministrationView({
  puzzles,
  selection,
  replacementComplete,
  lifecycleActionComplete,
  betaIssuedDate = null,
  archiveBetaStartDate,
  currentDate,
  todayLineup,
  historyLineups,
  historyWindow,
}: DailyAdministrationViewProps): JSX.Element {
  const selectedPuzzle = selection === null
    ? undefined
    : puzzles.find(puzzle => puzzle.puzzleDate === selection.puzzleDate);
  const selectedSlot = selectedPuzzle?.selections.find(slot => slot.slot === selection?.slot);

  return (
    <main style={{ maxWidth: 1500, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'end', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Authorized operations</p>
          <h1 style={{ marginBottom: 8 }}>Daily lineup administration</h1>
          <p style={{ margin: 0 }}>Review, edit, approve, publish, and archive Daily lineups through the portable editorial lifecycle.</p>
          <p><a href="/admin/daily/attempts" style={textLinkStyle}>Attempt scores · AB 1–9</a></p>
          {process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED === 'true' ? (
            <p><a href="/admin/daily/editions" style={textLinkStyle}>Secondary Daily editions (staging)</a></p>
          ) : null}
          <p><a href="/admin/custom-nine" style={textLinkStyle}>Create a Custom Nine</a></p>
          <p><a href="/admin/daily-five" style={textLinkStyle}>Future Daily Five draft workbench (staging)</a></p>
        </div>
        <form action="/admin/daily/generate" method="post">
          <button type="submit" style={buttonStyle}>Generate missing drafts</button>
        </form>
      </header>

      <ArchiveBetaIssuanceForm startDate={archiveBetaStartDate} currentDate={currentDate} verifiedDate={betaIssuedDate} />

      {replacementComplete ? (
        <p role="status" style={successStyle}>Replacement saved. Duplicate, repeat, and reveal-readiness checks ran again.</p>
      ) : null}

      {lifecycleActionComplete !== null ? (
        <p role="status" style={successStyle}>{getDailyLifecycleSuccessMessage(lifecycleActionComplete)}</p>
      ) : null}

      {selectedPuzzle !== undefined && selectedSlot !== undefined ? (
        <EditorPanel
          puzzle={selectedPuzzle}
          slot={selectedSlot}
        />
      ) : null}

      <section aria-label="Today's Daily lineup" style={{ ...cardStyle, marginTop: 28 }}>
        <p className="eyebrow">Primary Daily · {currentDate}</p>
        <h2 style={{ marginTop: 0 }}>Today's lineup · Daily #{todayLineup.puzzleNumber}</h2>
        <p style={{ marginTop: 0 }}>Current lineup · {formatLineupStatus(todayLineup.status)}</p>
        <ReadOnlyLineupPlayers lineup={todayLineup} />
      </section>

      {puzzles.length === 0 ? (
        <section style={emptyStyle}>
          <h2>No editorial puzzles in the upcoming horizon</h2>
          <p>Use Generate missing drafts to create the deterministic seven-day proposal.</p>
        </section>
      ) : (
        <section aria-label="Upcoming Daily editorial puzzles" style={{ display: 'grid', gap: 24, marginTop: 28 }}>
          <h2 style={{ margin: 0 }}>Upcoming Daily lineups · next 30 days</h2>
          {puzzles.map(puzzle => <PuzzleCard key={puzzle.puzzleDate} puzzle={puzzle} selection={selection} archiveBetaEligible={puzzle.puzzleDate >= archiveBetaStartDate} />)}
        </section>
      )}

      <section aria-label="Past Daily lineups" style={{ marginTop: 32 }}>
        <h2>Past Daily lineups</h2>
        <p>Previous primary lineups, newest first. Open any day to see its nine players.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {historyLineups.map(lineup => (
            <details key={lineup.puzzleDate} style={cardStyle}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                Daily #{lineup.puzzleNumber} · {lineup.puzzleDate}
                <span style={{ fontWeight: 400, marginLeft: 12 }}>{formatLineupStatus(lineup.status)}</span>
              </summary>
              <ReadOnlyLineupPlayers lineup={lineup} />
            </details>
          ))}
        </div>
        <nav aria-label="Past lineup pages" style={{ display: 'flex', gap: 24, marginTop: 20 }}>
          {historyWindow.olderEndDate ? (
            <a href={`/admin/daily?historyEnd=${historyWindow.olderEndDate}`} style={textLinkStyle}>Older lineups</a>
          ) : null}
          {historyWindow.newerEndDate ? (
            <a href={`/admin/daily?historyEnd=${historyWindow.newerEndDate}`} style={textLinkStyle}>Newer lineups</a>
          ) : null}
        </nav>
      </section>
    </main>
  );
}

function ReadOnlyLineupPlayers({ lineup }: { lineup: DailyAdminHistoricalLineup }): JSX.Element {
  return <ol style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, paddingLeft: 24, marginBottom: 0 }}>
    {lineup.players.map(player => (
      <li key={player.slot} value={player.slot}>
        <strong>{player.displayName}</strong>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{player.yearsPlayedDisplay}</div>
      </li>
    ))}
  </ol>;
}

function formatLineupStatus(status: DailyAdminHistoricalLineup['status']): string {
  return status === 'fallback' ? 'Original generated lineup' : status;
}

function EditorPanel({ puzzle, slot }: {
  puzzle: DailyEditorialHorizonPuzzle; slot: DailyEditorialHorizonSlot;
}): JSX.Element {
  const editable = puzzle.status === 'draft' || puzzle.status === 'scheduled';
  return <section aria-label="Player replacement editor" style={{ ...cardStyle, marginTop: 28 }}>
    <p className="eyebrow">Editing {puzzle.puzzleDate} · Slot {slot.slot}</p>
    <h2>Replace {slot.player?.player.displayName ?? 'unresolved player'}</h2>
    <p>{editable ? 'Search by player name or alias, inspect the exact game preview, then save the selected player.' : 'Published and archived puzzles cannot be changed through ordinary replacement.'}</p>
    <a href="/admin/daily" style={linkButtonStyle}>Close editor</a>
    {editable ? <PrimaryPlayerEditor key={`${puzzle.puzzleDate}:${slot.slot}`} puzzleDate={puzzle.puzzleDate} slot={slot.slot} /> : null}
  </section>;
}

function PuzzleCard({
  puzzle,
  selection,
  archiveBetaEligible,
}: {
  puzzle: DailyEditorialHorizonPuzzle;
  selection: DailyAdminEditorSelection | null;
  archiveBetaEligible: boolean;
}): JSX.Element {
  return (
    <article style={cardStyle}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>{puzzle.puzzleDate}</p>
          <h2 style={{ margin: 0 }}>Daily Inning #{puzzle.puzzleNumber}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <strong>{puzzle.status.toUpperCase()}</strong>
            <div style={{ fontSize: 14, opacity: 0.7 }}>Revision {puzzle.revision} · {puzzle.validation.valid ? 'Valid' : 'Needs review'}</div>
          </div>
          <DailyLifecycleActionForm puzzleDate={puzzle.puzzleDate} status={puzzle.status} archiveBetaEligible={archiveBetaEligible} />
        </div>
      </header>

      <div style={{ overflowX: 'auto', marginTop: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
          <thead>
            <tr>{['Slot', 'Player', 'Career', 'Type', 'Position', 'Teams', 'Last Daily use', 'Source', 'Warnings', 'Replacement'].map(label => <th key={label} style={headCellStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {puzzle.selections.map(slot => <SlotRow key={slot.slot} puzzle={puzzle} slot={slot} selected={selection?.puzzleDate === puzzle.puzzleDate && selection.slot === slot.slot} />)}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function SlotRow({ puzzle, slot, selected }: { puzzle: DailyEditorialHorizonPuzzle; slot: DailyEditorialHorizonSlot; selected: boolean }): JSX.Element {
  const validation = puzzle.validation.slots.find(candidate => candidate.slot === slot.slot);
  const review = slot.player;
  const player = review?.player;
  const editable = puzzle.status === 'draft' || puzzle.status === 'scheduled';

  return (
    <tr style={selected ? { background: 'rgba(23, 51, 38, 0.07)' } : undefined}>
      <td style={bodyCellStyle}><strong>{slot.slot}</strong></td>
      <td style={bodyCellStyle}><strong>{player?.displayName ?? 'Missing canonical player'}</strong></td>
      <td style={bodyCellStyle}>{player?.yearsPlayedDisplay || '—'}</td>
      <td style={bodyCellStyle}>{player?.primaryRole ?? '—'}</td>
      <td style={bodyCellStyle}>{player?.primaryPosition ?? '—'}</td>
      <td style={bodyCellStyle}>{player?.teamsDisplay || '—'}</td>
      <td style={bodyCellStyle}>{validation?.lastDailyUsage ?? 'None in 90 days'}</td>
      <td style={bodyCellStyle}>{slot.source}</td>
      <td style={bodyCellStyle}>{validation?.warnings.join(', ') || 'None'}</td>
      <td style={bodyCellStyle}>{editable ? <a href={buildEditorHref(puzzle.puzzleDate, slot.slot)} style={textLinkStyle}>Search / replace</a> : 'Locked'}</td>
    </tr>
  );
}

function buildEditorHref(puzzleDate: string, slot: number): string {
  const params = new URLSearchParams({ puzzleDate, slot: String(slot) });
  return `/admin/daily?${params.toString()}`;
}

const buttonStyle = { border: '1px solid #162116', borderRadius: 10, padding: '12px 16px', background: '#173326', color: '#f9f3e6', font: 'inherit', fontWeight: 700, cursor: 'pointer' } as const;
const linkButtonStyle = { ...buttonStyle, display: 'inline-block', textDecoration: 'none' } as const;
const cardStyle = { border: '1px solid rgba(22, 33, 22, 0.18)', borderRadius: 16, background: 'rgba(255, 252, 244, 0.96)', padding: 20 } as const;
const emptyStyle = { ...cardStyle, marginTop: 28 } as const;
const successStyle = { ...cardStyle, marginTop: 20, borderColor: '#315f43', background: '#eef8ef' } as const;
const textLinkStyle = { color: '#173326', fontWeight: 700 } as const;
const headCellStyle = { padding: '10px 12px', borderBottom: '2px solid #162116', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const bodyCellStyle = { padding: 12, borderBottom: '1px solid rgba(22, 33, 22, 0.14)', textAlign: 'left', verticalAlign: 'top', fontSize: 14 } as const;
