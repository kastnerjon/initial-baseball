import React, { type JSX } from 'react';
import { adminAttemptReportHref, type AdminAttemptReport } from '../../../dailyAdminAttemptReport';

export function DailyAttemptScoresView({ report }: { report: AdminAttemptReport }): JSX.Element {
  const { filter, rows, next } = report;
  return (
    <main style={{ maxWidth: 1500, margin: '0 auto', padding: 24 }}>
      <p className="eyebrow">Authorized operations</p>
      <h1>Attempt scores</h1>
      <p><a href="/admin/daily">Lineup administration</a></p>
      <p>Anonymous attempts, not named users. This report only reads results; it does not change scores or averages.</p>
      <form action="/admin/daily/attempts" method="get" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label>Date<br /><input type="date" name="date" defaultValue={filter.date} required style={input} /></label>
        <label>Scoring version<br /><select name="ruleset" defaultValue={filter.ruleset} style={input}><option value="points-v4">Current · points-v4</option><option value="points-v3">Historical · points-v3</option></select></label>
        <label style={{ flex: '1 1 280px' }}>Exact lineup ID (optional)<br /><input name="puzzleId" placeholder="Leave blank for the stored lineup on this date" style={{ ...input, width: '100%' }} /></label>
        <button type="submit" style={input}>Load attempts</button>
      </form>
      <p style={{ overflowWrap: 'anywhere' }}><strong>Showing:</strong> {filter.date} · {filter.ruleset} · <code>{filter.puzzleId || 'No stored lineup; enter an exact lineup ID'}</code></p>
      <p>Leave lineup ID blank when choosing another date. Enter an exact ID to inspect an old edition or archive separately.</p>
      <p>— = no recorded score. † = derived from completed-game facts, without an individual AB receipt. Zero is a recorded score. “Seed ID pattern” matches the October 6 copy convention. IDs are client-supplied; this does not prove a row’s origin.</p>
      <p>Each page reads up to 50 AB attempts and 50 completed records, joining matching IDs and showing completion-only attempts separately. Times are server receipt times in Eastern time; they may follow delayed delivery.</p>
      <nav aria-label="Attempt report actions" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
        <a href={adminAttemptReportHref({ ...filter, abAfter: '', completedAfter: '' })}>Refresh / first page</a>
        {filter.puzzleId ? <a href={adminAttemptReportHref(filter, true)}>Export this page as CSV</a> : null}
        {next ? <a href={adminAttemptReportHref(next)}>Next results</a> : null}
      </nav>
      {rows.length === 0 ? <p role="status">No recorded attempts for this selection.</p> : (
        <div role="region" aria-label="Attempt scores table" tabIndex={0} style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse' }}>
            <caption style={{ textAlign: 'left', paddingBottom: 12 }}>{rows.length} attempts on this page. AB receipts and completions are separate populations.</caption>
            <thead><tr>{['Attempt', 'Status', ...Array.from({ length: 9 }, (_, i) => `AB ${i + 1}`), 'Received AB points', 'Completed points', 'First / last receipt'].map(label => <th key={label} scope="col" style={cell}>{label}</th>)}</tr></thead>
            <tbody>{rows.map(row => (
              <tr key={row.id}>
                <th scope="row" style={{ ...cell, maxWidth: 220, overflowWrap: 'anywhere', fontWeight: 400 }}><code>{row.id}</code>{row.seedIdConvention ? <><br /><strong>Seed ID pattern</strong></> : null}</th>
                <td style={cell}>{row.completedPoints === null ? `Partial · ${row.recordedAtBats}/9 ABs received` : row.recordedAtBats === 9 ? 'Completed · 9/9 ABs received' : `Completed · ${row.recordedAtBats}/9 ABs received`}{row.warning ? <p role="status">{row.warning}</p> : null}</td>
                {row.scores.map((score, i) => <td key={i} style={cell} title={score?.source === 'AB' ? `AB received ${eastern(score.receivedAt!)}` : score ? 'Completed facts only; not an AB population observation' : 'No recorded score'}>{score ? `${score.points}${score.source === 'completion' ? '†' : ''}` : '—'}</td>)}
                <td style={cell}>{row.recordedAtBats === 0 ? '—' : row.recordedPoints}</td>
                <td style={cell}>{row.completedPoints ?? '—'}</td>
                <td style={cell}>{eastern(row.firstReceived)}<br />{eastern(row.lastReceived)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p>CSV includes the full attempt ID, each score’s source and individual AB receipt times in UTC. It exports this page only. Live results may change between refreshes or exports.</p>
    </main>
  );
}

function eastern(timestamp: string): string {
  return easternFormatter.format(new Date(timestamp));
}
const easternFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
const input = { font: 'inherit', padding: '10px 12px', borderRadius: 8, border: '1px solid #526354', boxSizing: 'border-box' } as const;
const cell = { padding: '12px 10px', textAlign: 'left', verticalAlign: 'top', borderBottom: '1px solid #b9c4ba' } as const;
