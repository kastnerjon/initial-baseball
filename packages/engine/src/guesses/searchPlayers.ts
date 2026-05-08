import type { Player } from '@initial-baseball/shared';
import { normalizeGuess } from './normalizeGuess.js';

export type PlayerSearchResult = {
  playerId: string;
  acceptedPlayerIds: string[];
  displayName: string;
  fullName: string;
  metadata?: {
    dailyEligibilityTier?: Player['dailyEligibilityTier'];
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
const ELIGIBILITY_PRIORITIES: Record<Player['dailyEligibilityTier'], number> = {
  core: 0,
  extended: 1,
  none: 2,
};

export function searchPlayers(query: string, players: Player[]): PlayerSearchResult[] {
  const normalizedQuery = normalizeGuess(query);

  if (!normalizedQuery) {
    return [];
  }

  const acceptedPlayerIdsByVisibleName = buildAcceptedPlayerIdsByVisibleName(players);
  const rankedResults = players
    .map((player) => rankPlayerSearchResult(normalizedQuery, player, acceptedPlayerIdsByVisibleName))
    .filter((result): result is RankedPlayerSearchResult => result !== null)
    .sort(compareRankedResults);

  return dedupeRankedResults(rankedResults)
    .slice(0, SEARCH_RESULT_LIMIT);
}

function rankPlayerSearchResult(
  query: string,
  player: Player,
  acceptedPlayerIdsByVisibleName: Map<string, string[]>,
): RankedPlayerSearchResult | null {
  const searchableFields = [player.fullName, player.displayName, ...player.aliases].map(normalizeGuess);
  const matchIndexes = searchableFields
    .map((field) => getSearchMatchIndex(query, field))
    .filter((index): index is number => index !== null);

  if (matchIndexes.length === 0) {
    return null;
  }

  const bestIndex = Math.min(...matchIndexes);

  return {
    playerId: player.id,
    acceptedPlayerIds: acceptedPlayerIdsByVisibleName.get(normalizeGuess(player.displayName)) ?? [player.id],
    displayName: player.displayName,
    fullName: player.fullName,
    metadata: {
      dailyEligibilityTier: player.dailyEligibilityTier,
      mainDecade: player.mainDecade,
      primaryPosition: player.primaryPosition,
      teamsDisplay: player.teamsDisplay,
    },
    matchPriority: bestIndex === 0 ? 0 : 1,
    bestIndex,
  };
}

function getSearchMatchIndex(query: string, field: string): number | null {
  const directIndex = field.indexOf(query);

  if (directIndex >= 0) {
    return directIndex;
  }

  return getTokenOrderMatchIndex(query, field);
}

function getTokenOrderMatchIndex(query: string, field: string): number | null {
  const queryTokens = query.split(' ').filter(Boolean);
  const fieldTokens = field.split(' ').filter(Boolean);
  let nextFieldTokenIndex = 0;
  let firstMatchIndex: number | null = null;

  for (const queryToken of queryTokens) {
    const matchedFieldTokenIndex = fieldTokens.findIndex((fieldToken, index) => (
      index >= nextFieldTokenIndex && fieldToken.startsWith(queryToken)
    ));

    if (matchedFieldTokenIndex < 0) {
      return null;
    }

    const matchedFieldToken = fieldTokens[matchedFieldTokenIndex];

    if (matchedFieldToken === undefined) {
      return null;
    }

    if (firstMatchIndex === null) {
      firstMatchIndex = field.indexOf(matchedFieldToken);
    }

    nextFieldTokenIndex = matchedFieldTokenIndex + 1;
  }

  return firstMatchIndex;
}

function buildAcceptedPlayerIdsByVisibleName(players: Player[]): Map<string, string[]> {
  const playersByVisibleName = new Map<string, Player[]>();

  for (const player of players) {
    const visibleNameKey = normalizeGuess(player.displayName);
    const visibleNamePlayers = playersByVisibleName.get(visibleNameKey) ?? [];
    visibleNamePlayers.push(player);
    playersByVisibleName.set(visibleNameKey, visibleNamePlayers);
  }

  return new Map([...playersByVisibleName.entries()].map(([visibleNameKey, visibleNamePlayers]) => [
    visibleNameKey,
    visibleNamePlayers
      .sort(compareAcceptedPlayerIdCandidates)
      .map((player) => player.id),
  ]));
}

function compareAcceptedPlayerIdCandidates(left: Player, right: Player): number {
  return (
    ELIGIBILITY_PRIORITIES[left.dailyEligibilityTier] - ELIGIBILITY_PRIORITIES[right.dailyEligibilityTier]
    || left.displayName.localeCompare(right.displayName)
    || left.fullName.localeCompare(right.fullName)
    || left.id.localeCompare(right.id)
  );
}

function compareRankedResults(left: RankedPlayerSearchResult, right: RankedPlayerSearchResult): number {
  return (
    left.matchPriority - right.matchPriority
    || left.bestIndex - right.bestIndex
    || left.displayName.localeCompare(right.displayName)
    || left.playerId.localeCompare(right.playerId)
  );
}

function dedupeRankedResults(results: RankedPlayerSearchResult[]): PlayerSearchResult[] {
  const playerIdDedupedResults = dedupeBy(results, (result) => result.playerId);
  const displayNameDedupedResults = dedupeBy(playerIdDedupedResults, (result) => normalizeGuess(result.displayName));
  const fullNameDedupedResults = dedupeBy(displayNameDedupedResults, (result) => normalizeGuess(result.fullName));

  return fullNameDedupedResults
    .sort(compareRankedResults)
    .map(({ matchPriority: _matchPriority, bestIndex: _bestIndex, ...result }) => result);
}

function dedupeBy(
  results: RankedPlayerSearchResult[],
  getDedupeKey: (result: RankedPlayerSearchResult) => string,
): RankedPlayerSearchResult[] {
  const selectedResults = new Map<string, RankedPlayerSearchResult>();

  for (const result of results) {
    const dedupeKey = getDedupeKey(result);
    const existingResult = selectedResults.get(dedupeKey);

    if (existingResult === undefined || compareDuplicateCandidates(result, existingResult) < 0) {
      selectedResults.set(dedupeKey, result);
    }
  }

  return Array.from(selectedResults.values());
}

function compareDuplicateCandidates(left: RankedPlayerSearchResult, right: RankedPlayerSearchResult): number {
  return (
    getEligibilityPriority(left) - getEligibilityPriority(right)
    || compareRankedResults(left, right)
  );
}

function getEligibilityPriority(result: PlayerSearchResult): number {
  return ELIGIBILITY_PRIORITIES[result.metadata?.dailyEligibilityTier ?? 'none'];
}
