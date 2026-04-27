import type { Player } from '@initial-baseball/shared';
import { normalizeGuess } from './normalizeGuess.js';

export type PlayerSearchResult = {
  playerId: string;
  displayName: string;
  fullName: string;
  metadata?: {
    mainDecade?: string;
    primaryPosition?: string;
    teamsDisplay?: string;
  };
};

type RankedPlayerSearchResult = PlayerSearchResult & {
  matchPriority: 0 | 1;
  bestIndex: number;
};

const SEARCH_RESULT_LIMIT = 10;

export function searchPlayers(query: string, players: Player[]): PlayerSearchResult[] {
  const normalizedQuery = normalizeGuess(query);

  if (!normalizedQuery) {
    return [];
  }

  const rankedResults = players
    .map((player) => rankPlayerSearchResult(normalizedQuery, player))
    .filter((result): result is RankedPlayerSearchResult => result !== null)
    .sort(compareRankedResults)
    .slice(0, SEARCH_RESULT_LIMIT);

  return rankedResults.map(({ matchPriority: _matchPriority, bestIndex: _bestIndex, ...result }) => result);
}

function rankPlayerSearchResult(query: string, player: Player): RankedPlayerSearchResult | null {
  const searchableFields = [player.fullName, ...player.aliases].map(normalizeGuess);
  const matchIndexes = searchableFields
    .map((field) => field.indexOf(query))
    .filter((index) => index >= 0);

  if (matchIndexes.length === 0) {
    return null;
  }

  const bestIndex = Math.min(...matchIndexes);

  return {
    playerId: player.id,
    displayName: player.displayName,
    fullName: player.fullName,
    metadata: {
      mainDecade: player.mainDecade,
      primaryPosition: player.primaryPosition,
      teamsDisplay: player.teamsDisplay,
    },
    matchPriority: bestIndex === 0 ? 0 : 1,
    bestIndex,
  };
}

function compareRankedResults(left: RankedPlayerSearchResult, right: RankedPlayerSearchResult): number {
  return (
    left.matchPriority - right.matchPriority
    || left.bestIndex - right.bestIndex
    || left.displayName.localeCompare(right.displayName)
    || left.playerId.localeCompare(right.playerId)
  );
}
