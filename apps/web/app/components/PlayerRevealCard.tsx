import type { JSX } from 'react';
import type { Player, PlayerCareerStatStrip, PlayerRole } from '@initial-baseball/shared';

export type PlayerRevealCardPlayer = Partial<Pick<
  Player,
  | 'displayName'
  | 'fullName'
  | 'primaryRole'
  | 'primaryPosition'
  | 'primaryTeam'
  | 'teamsDisplay'
  | 'statsLine'
  | 'yearsPlayedDisplay'
  | 'careerStats'
>>;

type PlayerRevealCardProps = {
  player: PlayerRevealCardPlayer;
};

const EMPTY_VALUE = '—';

export function PlayerRevealCard({ player }: PlayerRevealCardProps): JSX.Element {
  const displayName = cleanValue(player.displayName) ?? cleanValue(player.fullName) ?? EMPTY_VALUE;
  const role = formatRole(player.primaryRole);
  const position = cleanValue(player.primaryPosition);
  const primaryTeam = cleanValue(player.primaryTeam);
  const yearsPlayed = cleanValue(player.yearsPlayedDisplay);
  const meta = [yearsPlayed, role, position, primaryTeam].filter((value) => value !== null).join(' · ') || EMPTY_VALUE;
  const teamsDisplay = cleanValue(player.teamsDisplay);

  return (
    <section className="player-reveal-card" aria-label={`Player reveal: ${displayName}`}>
      <div className="player-reveal-heading">
        <span className="player-reveal-kicker">Player Reveal</span>
        <h2 className="player-reveal-name">{displayName}</h2>
        <p className="player-reveal-meta">{meta}</p>
        <p className="player-reveal-teams">{teamsDisplay === null ? 'Teams unavailable' : teamsDisplay}</p>
      </div>
      <CareerStatStrip careerStats={player.careerStats ?? null} fallbackStatsLine={player.statsLine} />
    </section>
  );
}

function CareerStatStrip({
  careerStats,
  fallbackStatsLine,
}: {
  careerStats: PlayerCareerStatStrip | null;
  fallbackStatsLine: string | undefined;
}): JSX.Element {
  if (careerStats === null) {
    return (
      <div className="player-reveal-stat-strip player-reveal-stat-strip-fallback">
        <span className="player-reveal-stat-header">Summary</span>
        <span className="player-reveal-stat-value">{cleanValue(fallbackStatsLine) ?? EMPTY_VALUE}</span>
      </div>
    );
  }

  if (careerStats.kind === 'pitcher') {
    const columns = ['W', 'L', 'ERA', 'WHIP', 'K', 'IP'] as const;

    return (
      <StatTable
        columns={columns}
        values={columns.map((column) => careerStats.stats[column])}
      />
    );
  }

  const columns = ['AB', 'H', 'HR', 'BA', 'R', 'RBI', 'SB', 'OBP', 'SLG', 'OPS'] as const;

  return (
    <StatTable
      columns={columns}
      values={columns.map((column) => careerStats.stats[column])}
    />
  );
}

function StatTable({
  columns,
  values,
}: {
  columns: readonly string[];
  values: Array<number | string>;
}): JSX.Element {
  return (
    <div className="player-reveal-stat-strip" role="region" aria-label="Career stat summary" tabIndex={0}>
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
          <tr>
            <th scope="row">Career</th>
            {values.map((value, index) => (
              <td key={columns[index]}>{value}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function cleanValue(value: string | undefined): string | null {
  const trimmedValue = value?.trim();

  return trimmedValue === undefined || trimmedValue.length === 0 ? null : trimmedValue;
}

function formatRole(role: PlayerRole | undefined): string | null {
  switch (role) {
    case 'hitter':
      return 'Hitter';
    case 'pitcher':
      return 'Pitcher';
    case 'two_way':
      return 'Two-way';
    default:
      return null;
  }
}
