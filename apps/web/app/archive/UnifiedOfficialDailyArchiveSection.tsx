import React, { type JSX } from 'react';
import type { UnifiedArchivePage } from '../unifiedOfficialDailyArchiveMerge';

/**
 * Read-only A4 presentation for one historical official Daily archive.
 *
 * An editorial primary publication is not an issued gameplay identity.
 * Secondary IDs link only to the source-integrated default-OFF practice route.
 * Legacy editorial primaries remain deliberately nonplayable placeholders.
 */
export function UnifiedOfficialDailyArchiveSection({ page }: {
  page: UnifiedArchivePage;
}): JSX.Element {
  return (
    <section aria-label="Official Daily archive">
      <h2>Official Daily editions</h2>
      <p>Past official lineups. Published secondary editions are available for practice; historical primary replay remains unavailable.</p>
      {page.dates.length === 0 ? (
        <p>No earlier official editions have been issued yet.</p>
      ) : (
        <div>
          {page.dates.map(group => (
            <section key={group.puzzleDate} aria-label={`Official puzzles for ${group.puzzleDate}`}>
              <h3>{group.puzzleDate}</h3>
              <ul>
                {group.editions.map(edition => (
                  <li key={`${edition.puzzleDate}:${edition.editionNumber}`}>
                    {edition.kind === 'legacy-primary' ? (
                      <>
                        <span>{`${edition.puzzleDate} – ${edition.title}`}</span>
                        {' · Historical replay unavailable'}
                      </>
                    ) : (
                      <>
                        <a href={`/daily/editions/${encodeURIComponent(edition.puzzleId)}?date=${encodeURIComponent(edition.puzzleDate)}`}>
                          {`${edition.puzzleDate} – ${edition.title}`}
                        </a>
                        {' · Practice only; scores are not submitted'}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {page.nextCursor === null ? null : (
        <a href={`/archive?afterDate=${encodeURIComponent(page.nextCursor.puzzleDate)}&afterEdition=${page.nextCursor.editionNumber}`}>
          Older official editions
        </a>
      )}
    </section>
  );
}
