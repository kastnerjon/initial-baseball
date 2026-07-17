'use client';

import { useState, type JSX } from 'react';
import type {
  Player,
  PlayerCareerStatStrip,
  PlayerRole,
  PlayerSeasonStatRow,
} from '@initial-baseball/shared';

export type PlayerRevealCardPlayer = Partial<Pick<
  Player,
  | 'id'
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
const HITTER_COLUMNS = ['AB', 'H', 'HR', 'BA', 'R', 'RBI', 'SB', 'OBP', 'SLG', 'OPS'] as const;
const PITCHER_COLUMNS = ['W', 'L', 'SV', 'ERA', 'WHIP', 'K', 'IP'] as const;

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
      <SeasonStatsDisclosure playerId={player.id} careerStats={player.careerStats ?? null} />
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

  const columns = careerStats.kind === 'pitcher' ? PITCHER_COLUMNS : HITTER_COLUMNS;

  return (
    <StatTable
      columns={columns}
      rows={[{
        key: 'career',
        label: 'Career',
        values: columns.map((column) => careerStats.stats[column]),
      }]}
      ariaLabel="Career stat summary"
    />
  );
}

function SeasonStatsDisclosure({
  playerId,
  careerStats,
}: {
  playerId: string | undefined;
  careerStats: PlayerCareerStatStrip | null;
}): JSX.Element | null {
  const [seasons, setSeasons] = useState<PlayerSeasonStatRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!playerId || careerStats === null) {
    return null;
  }

  async function loadSeasons(): Promise<void> {
    if (loading || seasons !== null) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/player-seasons?playerId=${encodeURIComponent(playerId ?? '')}`);
      if (!response.ok) throw new Error(`Season request failed with ${response.status}.`);
      const payload = await response.json() as { seasons?: PlayerSeasonStatRow[] };
      setSeasons(Array.isArray(payload.seasons) ? payload.seasons : []);
    } catch {
      setError('Season stats are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="player-season-stats" onToggle={(event) => {
      if (event.currentTarget.open) void loadSeasons();
    }}>
      <summary>View season-by-season stats</summary>
      {loading ? <p>Loading season stats…</p> : null}
      {error === null ? null : <p role="alert">{error}</p>}
      {seasons !== null && seasons.length === 0 ? <p>No season stats available.</p> : null}
      {seasons !== null && seasons.length > 0 ? (
        <SeasonStatTable seasons={seasons} careerKind={careerStats.kind} />
      ) : null}
    </details>
  );
}

function SeasonStatTable({
  seasons,
  careerKind,
}: {
  seasons: PlayerSeasonStatRow[];
  careerKind: PlayerCareerStatStrip['kind'];
}): JSX.Element {
  const columns = careerKind === 'pitcher' ? PITCHER_COLUMNS : HITTER_COLUMNS;
  const matchingSeasons = seasons.filter((season) => season.kind === careerKind);

  return (
    <StatTable
      columns={columns}
      rows={matchingSeasons.map((season) => ({
        key: `${season.year}:${season.teams}`,
        label: `${season.year} · ${season.teams || EMPTY_VALUE}`,
        values: columns.map((column) => season.stats[column]),
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
    values: Array<number | string>;
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
                <td key={columns[index]}>{value}</td>
              ))}
            </tr>
          ))}
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
