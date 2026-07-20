import type { JSX } from 'react';
import type { CanonicalRevealViewModel } from '../canonicalRevealViewModel';

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
        <p className="player-reveal-teams">{teamsDisplay.length === 0 ? 'Teams unavailable' : teamsDisplay}</p>
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
  if (reveal.career.kind === 'pitcher') {
    return (
      <StatTable
        columns={PITCHER_COLUMNS}
        rows={[{
          key: 'career',
          label: 'Career',
          values: PITCHER_COLUMNS.map((column) => reveal.career.stats[column] ?? EMPTY_VALUE),
        }]}
        ariaLabel="Career stat summary"
      />
    );
  }

  return (
    <StatTable
      columns={HITTER_COLUMNS}
      rows={[{
      key: 'career',
      label: 'Career',
      values: HITTER_COLUMNS.map((column) => reveal.career.stats[column] ?? EMPTY_VALUE),
      }]}
      ariaLabel="Career stat summary"
    />
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
        <SeasonStatTable reveal={reveal} />
      )}
    </details>
  );
}

function SeasonStatTable({
  reveal,
}: {
  reveal: CanonicalRevealViewModel;
}): JSX.Element {
  if (reveal.career.kind === 'pitcher') {
    return (
      <StatTable
        columns={PITCHER_COLUMNS}
        rows={reveal.seasons.map((season) => ({
          key: `${season.season}:${season.teamIds.join(',')}`,
          label: `${season.season} · ${season.teamIds.join(', ') || EMPTY_VALUE}`,
          values: PITCHER_COLUMNS.map((column) => season.stats[column]),
        }))}
        ariaLabel="Season-by-season statistics"
      />
    );
  }

  return (
    <StatTable
      columns={HITTER_COLUMNS}
      rows={reveal.seasons.map((season) => ({
        key: `${season.season}:${season.teamIds.join(',')}`,
        label: `${season.season} · ${season.teamIds.join(', ') || EMPTY_VALUE}`,
        values: HITTER_COLUMNS.map((column) => season.stats[column]),
      }))}
      ariaLabel="Season-by-season statistics"
    />
  );
}

function StatTable({
  columns,
  rows,
  ariaLabel,
}: {
  columns: readonly string[];
  rows: Array<{
    key: string;
    label: string;
    values: Array<number | string | undefined>;
  }>;
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
