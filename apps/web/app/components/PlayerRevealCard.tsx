import type { JSX } from 'react';
import type { Player, PlayerRole } from '@initial-baseball/shared';

export type PlayerRevealCardPlayer = Partial<Pick<
  Player,
  'displayName' | 'fullName' | 'primaryRole' | 'primaryPosition' | 'primaryTeam' | 'mainDecade' | 'teamsDisplay' | 'statsLine'
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
  const meta = [role, position, primaryTeam].filter((value) => value !== null).join(' · ') || EMPTY_VALUE;

  return (
    <section className="player-reveal-card" aria-label={`Player reveal: ${displayName}`}>
      <div className="player-reveal-topline">
        <div className="player-reveal-silhouette" aria-hidden="true">
          <span className="player-reveal-cap" />
          <span className="player-reveal-head" />
          <span className="player-reveal-shoulders" />
        </div>
        <div className="player-reveal-heading">
          <span className="player-reveal-kicker">Player Reveal</span>
          <h2 className="player-reveal-name">{displayName}</h2>
          <p className="player-reveal-meta">{meta}</p>
        </div>
      </div>
      <dl className="player-reveal-details">
        <RevealDetail label="Era" value={player.mainDecade} />
        <RevealDetail label="Teams" value={player.teamsDisplay} />
        <RevealDetail label="Career" value={player.statsLine} />
      </dl>
    </section>
  );
}

function RevealDetail({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}): JSX.Element {
  return (
    <div className="player-reveal-detail">
      <dt>{label}</dt>
      <dd>{cleanValue(value) ?? EMPTY_VALUE}</dd>
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
