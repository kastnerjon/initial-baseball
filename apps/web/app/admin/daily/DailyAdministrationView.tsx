import type { DailyEditorialHorizonPuzzle, DailyEditorialHorizonSlot } from '@initial-baseball/daily';
import type { DailyPuzzleStatus } from '@initial-baseball/shared';
import type { JSX } from 'react';
import type {
  DailyAdminLifecycleAction,
  DailyAdminPlayerPreview,
  DailyAdminPlayerSearchResult,
} from '../../dailyAdminWorkflow';

export type DailyAdminEditorSelection = {
  puzzleDate: string;
  slot: number;
};

type DailyAdministrationViewProps = {
  puzzles: readonly DailyEditorialHorizonPuzzle[];
  selection: DailyAdminEditorSelection | null;
  query: string;
  searchResults: readonly DailyAdminPlayerSearchResult[];
  preview: DailyAdminPlayerPreview | null;
  replacementComplete: boolean;
  lifecycleActionComplete: DailyAdminLifecycleAction | null;
};

export function DailyAdministrationView({
  puzzles,
  selection,
  query,
  searchResults,
  preview,
  replacementComplete,
  lifecycleActionComplete,
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
        </div>
        <form action="/admin/daily/generate" method="post">
          <button type="submit" style={buttonStyle}>Generate missing drafts</button>
        </form>
      </header>

      {replacementComplete ? (
        <p role="status" style={successStyle}>Replacement saved. Duplicate, rank-band, 90-day repeat, and reveal-readiness validation ran again.</p>
      ) : null}

      {lifecycleActionComplete !== null ? (
        <p role="status" style={successStyle}>{getLifecycleSuccessMessage(lifecycleActionComplete)}</p>
      ) : null}

      {selectedPuzzle !== undefined && selectedSlot !== undefined ? (
        <EditorPanel
          puzzle={selectedPuzzle}
          slot={selectedSlot}
          query={query}
          searchResults={searchResults}
          preview={preview}
        />
      ) : null}

      {puzzles.length === 0 ? (
        <section style={emptyStyle}>
          <h2>No editorial puzzles in the upcoming horizon</h2>
          <p>Use Generate missing drafts to create the deterministic seven-day proposal.</p>
        </section>
      ) : (
        <section aria-label="Upcoming Daily editorial puzzles" style={{ display: 'grid', gap: 24, marginTop: 28 }}>
          {puzzles.map(puzzle => <PuzzleCard key={puzzle.puzzleDate} puzzle={puzzle} selection={selection} />)}
        </section>
      )}
    </main>
  );
}

function EditorPanel({
  puzzle,
  slot,
  query,
  searchResults,
  preview,
}: {
  puzzle: DailyEditorialHorizonPuzzle;
  slot: DailyEditorialHorizonSlot;
  query: string;
  searchResults: readonly DailyAdminPlayerSearchResult[];
  preview: DailyAdminPlayerPreview | null;
}): JSX.Element {
  const current = slot.player;
  const editable = puzzle.status === 'draft' || puzzle.status === 'scheduled';

  return (
    <section aria-label="Player replacement editor" style={{ ...cardStyle, marginTop: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Editing {puzzle.puzzleDate} · Slot {slot.slot}</p>
          <h2 style={{ marginTop: 4 }}>Replace {current?.player.displayName ?? 'unresolved player'}</h2>
          <p style={{ marginBottom: 0 }}>{editable ? 'Search by player name or alias, inspect the exact game preview, then save the canonical player ID.' : 'Published and archived puzzles cannot be changed through ordinary replacement.'}</p>
        </div>
        <a href="/admin/daily" style={linkButtonStyle}>Close editor</a>
      </div>

      {editable ? (
        <form action="/admin/daily" method="get" style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <input type="hidden" name="puzzleDate" value={puzzle.puzzleDate} />
          <input type="hidden" name="slot" value={slot.slot} />
          <input name="q" defaultValue={query} placeholder="Search player name or alias" aria-label="Search player name or alias" style={inputStyle} />
          <button type="submit" style={buttonStyle}>Search</button>
        </form>
      ) : null}

      {query.length > 0 && searchResults.length === 0 ? <p>No Daily candidates matched “{query}”.</p> : null}
      {searchResults.length > 0 ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {searchResults.map(result => (
            <a
              key={result.canonicalPlayerId}
              href={buildEditorHref(puzzle.puzzleDate, slot.slot, query, result.canonicalPlayerId)}
              style={resultCardStyle}
            >
              <strong>{result.displayName}{result.requiresYearDisambiguation ? ` (${result.yearsPlayedDisplay})` : ''}</strong>
              <span>{result.playerType} · {result.primaryPosition} · {result.teamsDisplay || 'Teams unavailable'} · Rank {result.recognizabilityRank ?? '—'}</span>
              <code>{result.canonicalPlayerId}</code>
            </a>
          ))}
        </div>
      ) : null}

      {preview !== null ? <PlayerPreview puzzle={puzzle} slot={slot} preview={preview} /> : null}
    </section>
  );
}

function PlayerPreview({
  puzzle,
  slot,
  preview,
}: {
  puzzle: DailyEditorialHorizonPuzzle;
  slot: DailyEditorialHorizonSlot;
  preview: DailyAdminPlayerPreview;
}): JSX.Element {
  const reveal = preview.reveal;
  const teams = reveal.career.teamIdentities?.map(team => team.abbreviation).join(', ')
    || reveal.career.teamIds.join(', ')
    || 'Teams unavailable';
  const lines = buildCareerLines(preview);

  return (
    <section style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid rgba(22, 33, 22, 0.18)' }}>
      <p className="eyebrow">Exact game preview</p>
      <h3 style={{ margin: '4px 0 6px' }}>{preview.displayName} · {preview.initials}</h3>
      <p style={{ marginTop: 0 }}>{reveal.career.firstSeason}–{reveal.career.lastSeason} · {reveal.playerType} · {reveal.career.primaryPosition ?? 'Unknown'} · {teams}</p>
      {lines.map(line => <p key={line} style={{ margin: '6px 0' }}>{line}</p>)}
      <p style={{ margin: '6px 0' }}>Regular-season reveal rows: {reveal.seasons.length}</p>

      <ol style={{ paddingLeft: 22 }}>
        {preview.hints.map(hint => <li key={hint.hintType}><strong>{hint.hintLabel}:</strong> {hint.hintValue}</li>)}
      </ol>

      <form action="/admin/daily/replace" method="post" style={{ marginTop: 18 }}>
        <input type="hidden" name="puzzleDate" value={puzzle.puzzleDate} />
        <input type="hidden" name="slot" value={slot.slot} />
        <input type="hidden" name="canonicalPlayerId" value={preview.canonicalPlayerId} />
        <button type="submit" style={buttonStyle}>Replace slot {slot.slot} with {preview.displayName}</button>
      </form>
    </section>
  );
}

function PuzzleCard({
  puzzle,
  selection,
}: {
  puzzle: DailyEditorialHorizonPuzzle;
  selection: DailyAdminEditorSelection | null;
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
          <LifecycleActionForm puzzleDate={puzzle.puzzleDate} status={puzzle.status} />
        </div>
      </header>

      <div style={{ overflowX: 'auto', marginTop: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1420 }}>
          <thead>
            <tr>{['Slot / band', 'Canonical ID', 'Player', 'Career', 'Type', 'Position', 'Teams', 'Rank', 'Last Daily use', 'Source', 'Warnings', 'Replacement'].map(label => <th key={label} style={headCellStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {puzzle.selections.map(slot => <SlotRow key={slot.slot} puzzle={puzzle} slot={slot} selected={selection?.puzzleDate === puzzle.puzzleDate && selection.slot === slot.slot} />)}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function LifecycleActionForm({ puzzleDate, status }: { puzzleDate: string; status: DailyPuzzleStatus }): JSX.Element | null {
  const action = getLifecycleAction(status);
  if (action === null) return null;

  return (
    <form action="/admin/daily/lifecycle" method="post">
      <input type="hidden" name="puzzleDate" value={puzzleDate} />
      <input type="hidden" name="action" value={action.action} />
      <button type="submit" style={buttonStyle}>{action.label}</button>
    </form>
  );
}

function SlotRow({ puzzle, slot, selected }: { puzzle: DailyEditorialHorizonPuzzle; slot: DailyEditorialHorizonSlot; selected: boolean }): JSX.Element {
  const validation = puzzle.validation.slots.find(candidate => candidate.slot === slot.slot);
  const review = slot.player;
  const player = review?.player;
  const editable = puzzle.status === 'draft' || puzzle.status === 'scheduled';

  return (
    <tr style={selected ? { background: 'rgba(23, 51, 38, 0.07)' } : undefined}>
      <td style={bodyCellStyle}><strong>{slot.slot}</strong><br /><small>{validation?.expectedMinimumRank ?? '—'}–{validation?.expectedMaximumRank ?? '—'}</small></td>
      <td style={bodyCellStyle}><code>{review?.canonicalPlayerId ?? validation?.canonicalPlayerId ?? 'Unresolved'}</code></td>
      <td style={bodyCellStyle}><strong>{player?.displayName ?? 'Missing canonical player'}</strong></td>
      <td style={bodyCellStyle}>{player?.yearsPlayedDisplay || '—'}</td>
      <td style={bodyCellStyle}>{player?.primaryRole ?? '—'}</td>
      <td style={bodyCellStyle}>{player?.primaryPosition ?? '—'}</td>
      <td style={bodyCellStyle}>{player?.teamsDisplay || '—'}</td>
      <td style={bodyCellStyle}>{review?.recognizabilityRank ?? '—'}</td>
      <td style={bodyCellStyle}>{validation?.lastDailyUsage ?? 'None in 90 days'}</td>
      <td style={bodyCellStyle}>{slot.source}</td>
      <td style={bodyCellStyle}>{validation?.warnings.join(', ') || 'None'}</td>
      <td style={bodyCellStyle}>{editable ? <a href={buildEditorHref(puzzle.puzzleDate, slot.slot)} style={textLinkStyle}>Search / replace</a> : 'Locked'}</td>
    </tr>
  );
}

function getLifecycleAction(status: DailyPuzzleStatus): { action: DailyAdminLifecycleAction; label: string } | null {
  if (status === 'draft') return { action: 'schedule', label: 'Approve & schedule' };
  if (status === 'scheduled') return { action: 'publish', label: 'Publish' };
  if (status === 'published') return { action: 'archive', label: 'Archive' };
  return null;
}

function getLifecycleSuccessMessage(action: DailyAdminLifecycleAction): string {
  if (action === 'schedule') return 'Puzzle scheduled. Its revision and scheduling audit metadata were saved.';
  if (action === 'publish') return 'Puzzle published. Ordinary player replacement is now locked.';
  return 'Puzzle archived. Its published selections remain immutable.';
}

function buildCareerLines(preview: DailyAdminPlayerPreview): string[] {
  const { batting, pitching, advanced } = preview.reveal.career;
  return [
    batting === null ? null : `Career batting: ${batting.homeRuns ?? '—'} HR · ${batting.battingAverage ?? '—'} AVG · ${advanced?.ops ?? '—'} OPS`,
    pitching === null ? null : `Career pitching: ${pitching.wins ?? '—'} W · ${pitching.saves ?? '—'} SV · ${pitching.earnedRunAverage ?? '—'} ERA · ${pitching.whip ?? '—'} WHIP`,
  ].filter((line): line is string => line !== null);
}

function buildEditorHref(puzzleDate: string, slot: number, query = '', playerId = ''): string {
  const params = new URLSearchParams({ puzzleDate, slot: String(slot) });
  if (query.length > 0) params.set('q', query);
  if (playerId.length > 0) params.set('playerId', playerId);
  return `/admin/daily?${params.toString()}`;
}

const buttonStyle = { border: '1px solid #162116', borderRadius: 10, padding: '12px 16px', background: '#173326', color: '#f9f3e6', font: 'inherit', fontWeight: 700, cursor: 'pointer' } as const;
const linkButtonStyle = { ...buttonStyle, display: 'inline-block', textDecoration: 'none' } as const;
const cardStyle = { border: '1px solid rgba(22, 33, 22, 0.18)', borderRadius: 16, background: 'rgba(255, 252, 244, 0.96)', padding: 20 } as const;
const emptyStyle = { ...cardStyle, marginTop: 28 } as const;
const successStyle = { ...cardStyle, marginTop: 20, borderColor: '#315f43', background: '#eef8ef' } as const;
const inputStyle = { minWidth: 300, flex: 1, border: '1px solid rgba(22, 33, 22, 0.35)', borderRadius: 8, padding: '12px 14px', font: 'inherit' } as const;
const resultCardStyle = { display: 'grid', gap: 4, padding: 12, border: '1px solid rgba(22, 33, 22, 0.2)', borderRadius: 10, color: 'inherit', textDecoration: 'none' } as const;
const textLinkStyle = { color: '#173326', fontWeight: 700 } as const;
const headCellStyle = { padding: '10px 12px', borderBottom: '2px solid #162116', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const bodyCellStyle = { padding: 12, borderBottom: '1px solid rgba(22, 33, 22, 0.14)', textAlign: 'left', verticalAlign: 'top', fontSize: 14 } as const;
