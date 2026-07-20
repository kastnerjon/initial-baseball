import type { JSX } from 'react';
import type {
  CanonicalRevealStatLine,
  CanonicalRevealViewModel,
  RevealStatKind,
} from '../canonicalRevealViewModel';

type PlayerRevealCardProps = {
  reveal: CanonicalRevealViewModel;
};

const EMPTY_VALUE = '—';
const HITTER_COLUMNS = ['AB', 'H', 'HR', 'BA', 'R', 'RBI', 'SB', 'OBP', 'SLG', 'OPS'] as const;
const PITCHER_COLUMNS = ['W', 'L', 'SV', 'ERA', 'WHIP', 'K', 'IP'] as const;

export function PlayerRevealCard({ reveal }: PlayerRevealCardProps): JSX.Element {
  const role = formatRole(reveal.playerType);
  const meta = [reveal.yearsPlayedDisplay, role, reveal.primaryPosition]
    .filter((value) => value !== null)
    .join(' · ') || EMPTY_VALUE;
  const teamsDisplay = reveal.teamIds.join(', ');

  return (
    <section className="player-reveal-card" aria-label={`Player reveal: ${reveal.displayName}`}>
      <div className="player-reveal-heading">
        <span className="player-reveal-kicker">Player Reveal</span>
        <h2 className="player-reveal-name">{reveal.displayName}</h2>
        <p className="player-reveal-meta">{meta}</p>
        <p className="player-reveal-teams">
          {teamsDisplay.length === 0 ? 'Teams unavailable' : teamsDisplay}
        </p>
      </div>
      <CareerStatStrip reveal={reveal} />
      <SeasonStatsDisclosure reveal={reveal} />
    </section>
  );
}

function CareerStatStrip({
  reveal,
}: {
  reveal: CanonicalRevealViewModel;
}): JSX.Element {
  return (
    <div className="player-reveal-stat-lines">
      {reveal.career.lines.map((line) => (
        <StatLineGroup
          key={line.kind}
          line={line}
          showHeading={reveal.career.lines.length > 1}
          rows={[{
            key: `career:${line.kind}`,
            label: 'Career',
            values: getColumns(line.kind).map(
              (column) => line.stats[column] ?? EMPTY_VALUE,
            ),
          }]}
          ariaLabel={`Career ${getStatLineLabel(line.kind).toLowerCase()} summary`}
        />
      ))}
    </div>
  );
}

function SeasonStatsDisclosure({
  reveal,
}: {
  reveal: CanonicalRevealViewModel;
}): JSX.Element {
  return (
    <details className="player-season-stats">
      <summary>View season-by-season stats</summary>
      {reveal.seasons.length === 0 ? <p>No season stats available.</p> : (
        <SeasonStatTables reveal={reveal} />
      )}
    </details>
  );
}

function SeasonStatTables({
  reveal,
}: {
  reveal: CanonicalRevealViewModel;
}): JSX.Element {
  return (
    <div className="player-reveal-stat-lines">
      {reveal.career.lines.map((careerLine) => {
        const columns = getColumns(careerLine.kind);
        return (
          <StatLineGroup
            key={careerLine.kind}
            line={careerLine}
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
  showHeading,
  rows,
  ariaLabel,
}: {
  line: CanonicalRevealStatLine;
  showHeading: boolean;
  rows: StatTableRow[];
  ariaLabel: string;
}): JSX.Element {
  return (
    <section aria-label={showHeading ? getStatLineLabel(line.kind) : undefined}>
      {showHeading ? <h3>{getStatLineLabel(line.kind)}</h3> : null}
      <StatTable
        columns={getColumns(line.kind)}
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

function getColumns(kind: RevealStatKind): readonly string[] {
  return kind === 'pitcher' ? PITCHER_COLUMNS : HITTER_COLUMNS;
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
