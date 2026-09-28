import type { JSX } from 'react';

export type InningScoreboardValue = {
  display: string;
  accessibleLabel: string;
};

export type InningScoreboardColumn = {
  atBatNumber: number;
  initials: string;
  current: boolean;
  user: InningScoreboardValue;
  average: InningScoreboardValue;
};

export type InningScoreboardProps = {
  columns: InningScoreboardColumn[];
  totalUser: InningScoreboardValue;
  totalAverage: InningScoreboardValue;
};

export function InningScoreboard({
  columns,
  totalUser,
  totalAverage,
}: InningScoreboardProps): JSX.Element {
  return (
    <section className="inning-scoreboard-shell" aria-label="Daily Nine scoreboard">
      <div
        className="inning-scoreboard-scroll"
        role="region"
        aria-label="Scores by at-bat"
        tabIndex={0}
      >
        <table className="inning-scoreboard">
          <caption className="sr-only">Daily Nine scores and comparison averages by at-bat</caption>
          <thead>
            <tr>
              <th className="inning-scoreboard-corner" scope="col">AB</th>
              {columns.map(column => (
                <th
                  key={column.atBatNumber}
                  className={column.current
                    ? 'inning-scoreboard-inning inning-scoreboard-current'
                    : 'inning-scoreboard-inning'}
                  scope="col"
                  aria-current={column.current ? 'step' : undefined}
                  aria-label={`At bat ${column.atBatNumber}, initials ${column.initials}${column.current ? ', current at-bat' : ''}`}
                >
                  <span className="inning-scoreboard-current-marker" aria-hidden="true">
                    {column.current ? 'NOW' : ''}
                  </span>
                  <span className="inning-scoreboard-number">{column.atBatNumber}</span>
                  <span className="inning-scoreboard-initials">{column.initials}</span>
                </th>
              ))}
              <th className="inning-scoreboard-total" scope="col">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="inning-scoreboard-row-label" scope="row">YOU</th>
              {columns.map(column => (
                <td
                  key={column.atBatNumber}
                  className={column.current ? 'inning-scoreboard-current' : undefined}
                  aria-label={column.user.accessibleLabel}
                >
                  {column.user.display}
                </td>
              ))}
              <td className="inning-scoreboard-total" aria-label={totalUser.accessibleLabel}>
                {totalUser.display}
              </td>
            </tr>
            <tr>
              <th className="inning-scoreboard-row-label" scope="row">AVG</th>
              {columns.map(column => (
                <td
                  key={column.atBatNumber}
                  className={column.current ? 'inning-scoreboard-current' : undefined}
                  aria-label={column.average.accessibleLabel}
                >
                  {column.average.display}
                </td>
              ))}
              <td className="inning-scoreboard-total" aria-label={totalAverage.accessibleLabel}>
                {totalAverage.display}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
