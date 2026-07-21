import type { JSX } from 'react';
import type {
  CanonicalRevealStatLine,
  CanonicalRevealViewModel,
  RevealStatKind,
} from '../canonicalRevealViewModel';
import { normalizeCanonicalRevealViewModel } from '../normalizeCanonicalRevealViewModel';
import {
  getRevealColumns,
  type RevealColumnOverrides,
} from '../revealPresentationConfig';

type PlayerRevealCardProps = {
  reveal: CanonicalRevealViewModel;
  columns?: RevealColumnOverrides;
};

const EMPTY_VALUE = '—';

export function PlayerRevealCard({
  reveal,
  columns,
}: PlayerRevealCardProps): JSX.Element {
  const viewModel = normalizeCanonicalRevealViewModel(reveal);
  const role = formatRole(viewModel.playerType);
  const meta = [viewModel.yearsPlayedDisplay, role, viewModel.primaryPosition]
    .filter((value) => value !== null)
    .join(' · ') || EMPTY_VALUE;
  const teamsDisplay = viewModel.teamIds.join(', ');

  return (
    <section className="player-reveal-card" aria-label={`Player reveal: ${viewModel.displayName}`}>
      <div className="player-reveal-heading">
        <span className="player-reveal-kicker">Player Reveal</span>
        <h2 className="player-reveal-name">{viewModel.displayName}</h2>
        <p className="player-reveal-meta">{meta}</p>
        <p className="player-reveal-teams">
          {teamsDisplay.length === 0 ? 'Teams unavailable' : teamsDisplay}
        </p>
      </div>
      <CareerStatStrip reveal={viewModel} columnOverrides={columns} />
      <SeasonStatsDisclosure reveal={viewModel} columnOverrides={columns} />
    </section>
  );
}

function CareerStatStrip({
  reveal,
  columnOverrides,
}: {
  reveal: CanonicalRevealViewModel;
  columnOverrides: RevealColumnOverrides | undefined;
}): JSX.Element {
  return (
    <div className="player-reveal-stat-lines">
      {reveal.career.lines.map((line) => {
        const columns = getRevealColumns(line.kind, columnOverrides);
        return (
          <StatLineGroup
            key={line.kind}
            line={line}
            columns={columns}
            showHeading={reveal.career.lines.length > 1}
            rows={[{
              key: `career:${line.kind}`,
              label: 'Career',
              values: columns.map(
                (column) => line.stats[column] ?? EMPTY_VALUE,
              ),
            }]}
            ariaLabel={`Career ${getStatLineLabel(line.kind).toLowerCase()} summary`}
          />
        );
      })}
    </div>
  );
}

function SeasonStatsDisclosure({
  reveal,
  columnOverrides,
}: {
  reveal: CanonicalRevealViewModel;
  columnOverrides: RevealColumnOverrides | undefined;
}): JSX.Element {
  return (
    <details className="player-season-stats">
      <summary>View season-by-season stats</summary>
      {reveal.seasons.length === 0 ? <p>No season stats available.</p> : (
        <SeasonStatTables reveal={reveal} columnOverrides={columnOverrides} />
      )}
    </details>
  );
}

function SeasonStatTables({
  reveal,
  columnOverrides,
}: {
  reveal: CanonicalRevealViewModel;
  columnOverrides: RevealColumnOverrides | undefined;
}): JSX.Element {
  return (
    <div className="player-reveal-stat-lines">
      {reveal.career.lines.map((careerLine) => {
        const columns = getRevealColumns(careerLine.kind, columnOverrides);
        return (
          <StatLineGroup
            key={careerLine.kind}
            line={careerLine}
            columns={columns}
            showHeading={reveal.career.lines.length > 1}
            rows={reveal.seasons.map((season) => {
              const line = season.lines.find(
                (candidate) => candidate.kind === careerLine.kind,
              );
              return {
                key: `${season.season}:${season.teamIds.join(',')}:${careerLine.kind}`,
                label: `${season.season} · ${season.teamIds.join(', ') || EMPTY_VALUE}`,
                values: columns.map((column) => line?.stats[column] ?? EMPTY_VALUE),
              };
            })}
            ariaLabel={`Season-by-season ${getStatLineLabel(careerLine.kind).toLowerCase()} statistics`}
          />
        );
      })}
    </div>
  );
}

function StatLineGroup({
  line,
  columns,
  showHeading,
  rows,
  ariaLabel,
}: {
  line: CanonicalRevealStatLine;
  columns: readonly string[];
  showHeading: boolean;
  rows: StatTableRow[];
  ariaLabel: string;
}): JSX.Element {
  return (
    <section aria-label={showHeading ? getStatLineLabel(line.kind) : undefined}>
      {showHeading ? <h3>{getStatLineLabel(line.kind)}</h3> : null}
      <StatTable
        columns={columns}
        rows={rows}
        ariaLabel={ariaLabel}
      />
    </section>
  );
}

type StatTableRow = {
  key: string;
  label: string;
  values: Array<number | string | undefined>;
};

function StatTable({
  columns,
  rows,
  ariaLabel,
}: {
  columns: readonly string[];
  rows: StatTableRow[];
  ariaLabel: string;
}): JSX.Element {
  return (
    <div className="player-reveal-stat-strip" role="region" aria-label={ariaLabel} tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th scope="col">Summary</th>
            {columns.map((column) => (
              <th key={column} scope="col">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => (
                <td key={columns[index]}>{value ?? EMPTY_VALUE}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getStatLineLabel(kind: RevealStatKind): string {
  return kind === 'pitcher' ? 'Pitching' : 'Batting';
}

function formatRole(role: CanonicalRevealViewModel['playerType']): string {
  switch (role) {
    case 'hitter':
      return 'Hitter';
    case 'pitcher':
      return 'Pitcher';
    case 'two-way':
      return 'Two-way';
  }
}
