import type { DailyEditorialHorizonPuzzle, DailyEditorialHorizonSlot } from '@initial-baseball/daily';
import type { JSX } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DailyAdminAuthorizationError } from '../../dailyAdminAuthorization';
import { createDailyAdminContext } from '../../dailyAdminComposition';
import { createDailyAdminWorkflow } from '../../dailyAdminWorkflow';

export const dynamic = 'force-dynamic';

export default async function DailyAdministrationPage(): Promise<JSX.Element> {
  try {
    const requestHeaders = await headers();
    const { repository } = createDailyAdminContext({
      authorizationHeader: requestHeaders.get('authorization'),
    });
    const puzzles = await createDailyAdminWorkflow(repository).getHorizon();

    return (
      <main style={{ maxWidth: 1500, margin: '0 auto', padding: 24 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">Authorized operations</p>
            <h1 style={{ marginBottom: 8 }}>Daily lineup administration</h1>
            <p style={{ margin: 0 }}>Review the next seven Daily dates. Existing records are preserved; generation creates only missing drafts.</p>
          </div>
          <form action="/admin/daily/generate" method="post">
            <button type="submit" style={buttonStyle}>Generate missing drafts</button>
          </form>
        </header>

        {puzzles.length === 0 ? (
          <section style={emptyStyle}>
            <h2>No editorial puzzles in the upcoming horizon</h2>
            <p>Use Generate missing drafts to create the deterministic seven-day proposal.</p>
          </section>
        ) : (
          <section aria-label="Upcoming Daily editorial puzzles" style={{ display: 'grid', gap: 24, marginTop: 28 }}>
            {puzzles.map(puzzle => <PuzzleCard key={puzzle.puzzleDate} puzzle={puzzle} />)}
          </section>
        )}
      </main>
    );
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      redirect('/admin/daily/auth');
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

function PuzzleCard({ puzzle }: { puzzle: DailyEditorialHorizonPuzzle }): JSX.Element {
  return (
    <article style={cardStyle}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>{puzzle.puzzleDate}</p>
          <h2 style={{ margin: 0 }}>Daily Inning #{puzzle.puzzleNumber}</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong>{puzzle.status.toUpperCase()}</strong>
          <div style={{ fontSize: 14, opacity: 0.7 }}>Revision {puzzle.revision} · {puzzle.validation.valid ? 'Valid' : 'Needs review'}</div>
        </div>
      </header>

      <div style={{ overflowX: 'auto', marginTop: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1320 }}>
          <thead>
            <tr>{['Slot / band', 'Canonical ID', 'Player', 'Career', 'Type', 'Position', 'Teams', 'Rank', 'Last Daily use', 'Source', 'Warnings'].map(label => <th key={label} style={headCellStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {puzzle.selections.map(slot => <SlotRow key={slot.slot} puzzle={puzzle} slot={slot} />)}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function SlotRow({ puzzle, slot }: { puzzle: DailyEditorialHorizonPuzzle; slot: DailyEditorialHorizonSlot }): JSX.Element {
  const validation = puzzle.validation.slots.find(candidate => candidate.slot === slot.slot);
  const review = slot.player;
  const player = review?.player;
  const warnings = validation?.warnings.join(', ') || 'None';

  return (
    <tr>
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
      <td style={bodyCellStyle}>{warnings}</td>
    </tr>
  );
}

const buttonStyle = {
  border: '1px solid #162116',
  borderRadius: 10,
  padding: '12px 16px',
  background: '#173326',
  color: '#f9f3e6',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const cardStyle = {
  border: '1px solid rgba(22, 33, 22, 0.18)',
  borderRadius: 16,
  background: 'rgba(255, 252, 244, 0.96)',
  padding: 20,
} as const;

const emptyStyle = {
  ...cardStyle,
  marginTop: 28,
} as const;

const headCellStyle = {
  padding: '10px 12px',
  borderBottom: '2px solid #162116',
  textAlign: 'left',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
} as const;

const bodyCellStyle = {
  padding: '12px',
  borderBottom: '1px solid rgba(22, 33, 22, 0.14)',
  textAlign: 'left',
  verticalAlign: 'top',
  fontSize: 14,
} as const;
