import type { JSX } from 'react';

export function ArchiveBetaIssuanceForm({
  startDate,
  currentDate,
  verifiedDate,
}: {
  startDate: string;
  currentDate: string;
  verifiedDate: string | null;
}): JSX.Element {
  return (
    <section style={{ marginTop: 24, padding: 20, border: '1px solid #899889', borderRadius: 16 }}>
      <h2>Test archive</h2>
      <p>Freeze a scheduled or published lineup for the test archive. Once issued, its players and hints cannot be changed. Repeating an unchanged issue is safe.</p>
      {verifiedDate !== null ? <p role="status">Archive issuance and read-back verified for {verifiedDate}.</p> : null}
      <form action="/admin/daily/archive-beta/issue" method="post" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          Puzzle date
          <input name="puzzleDate" type="date" min={startDate} max={currentDate} defaultValue={startDate} required style={{ padding: 12, font: 'inherit' }} />
        </label>
        <button type="submit" style={{ padding: '12px 16px', borderRadius: 10, background: '#173326', color: '#f9f3e6', font: 'inherit' }}>Issue test archive puzzle</button>
      </form>
    </section>
  );
}
