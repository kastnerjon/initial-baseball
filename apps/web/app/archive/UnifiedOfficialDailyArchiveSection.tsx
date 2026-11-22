import React, { type JSX } from 'react';
import type { UnifiedArchivePage } from '../unifiedOfficialDailyArchiveMerge';

/**
 * Read-only A4 presentation for one historical official Daily archive.
 *
 * An editorial primary publication is not an issued gameplay identity.
 * Secondary IDs link to the same default-OFF shared Daily route, scored only when independently enabled.
 * Legacy editorial primaries remain deliberately nonplayable placeholders.
 */
export function UnifiedOfficialDailyArchiveSection({ page, practiceAvailable, competitiveAvailable }: {
  page: UnifiedArchivePage;
  practiceAvailable: boolean;
  competitiveAvailable: boolean;
}): JSX.Element {
  return (
    <section aria-label="Official Daily archive">
      <h2>Official Daily editions</h2>
      <p>Past official lineups. {practiceAvailable
        ? competitiveAvailable
          ? 'Published secondary editions support scored play; historical primary replay remains unavailable.'
          : 'Published secondary editions are available for practice; historical primary replay remains unavailable.'
        : 'Secondary practice is not yet available; historical primary replay remains unavailable.'}</p>
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
                    ) : practiceAvailable ? (
                      <>
                        <a href={`/daily/editions/${encodeURIComponent(edition.puzzleId)}?date=${encodeURIComponent(edition.puzzleDate)}`}>
                          {`${edition.puzzleDate} – ${edition.title}`}
                        </a>
                        {' · '}{competitiveAvailable
                          ? 'Scored play; results count for this edition'
                          : 'Practice only; scores are not submitted'}
                      </>
                    ) : (
                      <>
                        <span>{`${edition.puzzleDate} – ${edition.title}`}</span>
                        {' · Practice replay unavailable'}
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
