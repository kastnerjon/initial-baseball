import type { Player } from '@initial-baseball/shared';
import type { SingleAtBatDemo } from './components/AtBatCard';

export const DEMO_SINGLE_AT_BAT: SingleAtBatDemo = {
  puzzleNumber: 42,
  initials: 'KGJ',
  hintLabel: 'Main Decade',
  hintValue: '1990s',
  correctPlayerId: 'ken-griffey-jr',
};

export const DEMO_PLAYERS: Player[] = [
  buildPlayer('ken-griffey-jr', 'Ken Griffey Jr.', 'Ken Griffey Jr.', 'hitter', 'CF', '1990s', 'SEA, CIN, CHW', ['The Kid', 'Ken Griffey']),
  buildPlayer('ken-griffey-sr', 'Ken Griffey Sr.', 'Ken Griffey Sr.', 'hitter', 'OF', '1970s', 'CIN, NYY, ATL, SEA', []),
  buildPlayer('david-wright', 'David Wright', 'David Wright', 'hitter', '3B', '2000s', 'NYM', ['Captain America']),
  buildPlayer('david-ortiz', 'David Ortiz', 'David Ortiz', 'hitter', 'DH', '2000s', 'MIN, BOS', ['Big Papi']),
  buildPlayer('dave-winfield', 'Dave Winfield', 'Dave Winfield', 'hitter', 'RF', '1980s', 'SDP, NYY, CAL, TOR, MIN, CLE', []),
  buildPlayer('cc-sabathia', 'CC Sabathia', 'CC Sabathia', 'pitcher', 'SP', '2000s', 'CLE, MIL, NYY', ['Carsten Sabathia']),
  buildPlayer('andruw-jones', 'Andruw Jones', 'Andruw Jones', 'hitter', 'CF', '2000s', 'ATL, LAD, TEX, CHW, NYY', []),
  buildPlayer('jason-varitek', 'Jason Varitek', 'Jason Varitek', 'hitter', 'C', '2000s', 'BOS', ['Tek']),
];

function buildPlayer(
  id: string,
  fullName: string,
  displayName: string,
  primaryRole: Player['primaryRole'],
  primaryPosition: string,
  mainDecade: string,
  teamsDisplay: string,
  aliases: string[],
): Player {
  return {
    id,
    fullName,
    displayName,
    primaryRole,
    primaryPosition,
    mainDecade,
    teamsDisplay,
    aliases,
  };
}
