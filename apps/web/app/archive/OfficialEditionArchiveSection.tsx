import React, { type JSX } from 'react';
import type { OfficialDailyArchivePage } from '../serverOfficialDailyArchiveSection';

/** Read-only date groups; never receives clue snapshots or comparison aggregates. */
export function OfficialEditionArchiveSection({ page }: { page: OfficialDailyArchivePage }): JSX.Element {
  const cursor = page.nextCursor;
  return (
    <section aria-label="Official Daily archive">
      <h2>Official Daily editions</h2>
      <p>Earlier official puzzles. Practice scores are saved on this device, not submitted to leaderboards.</p>
      {page.dates.length === 0 ? <p>No earlier official editions have been issued yet.</p> : (
        <div>
          {page.dates.map(group => (
            <section key={group.puzzleDate} aria-label={`Official puzzles for ${group.puzzleDate}`}>
              <h3>{group.puzzleDate}</h3>
              <ul>
                {group.editions.map(edition => (
                  <li key={edition.puzzleId}>
                    <a href={`/daily/editions/${edition.puzzleId}?date=${encodeURIComponent(edition.puzzleDate)}`}>
                      {`${edition.puzzleDate} – ${edition.title}`}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {cursor === null ? null : (
        <a href={`/archive?afterDate=${encodeURIComponent(cursor.puzzleDate)}&afterEdition=${cursor.editionNumber}`}>
          Older official editions
        </a>
      )}
    </section>
  );
}
