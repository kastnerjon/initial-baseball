import type { Player } from '@initial-baseball/shared';
import { normalizeGuess } from './normalizeGuess.js';

export type PlayerSearchResult = {
  playerId: string;
  acceptedPlayerIds: string[];
  displayName: string;
  fullName: string;
  metadata?: {
    dailyEligibilityTier?: Player['dailyEligibilityTier'];
    firstYear?: number | null;
    lastYear?: number | null;
    mainDecade?: string;
    primaryPosition?: string;
    playerType?: string;
    teamsDisplay?: string;
  };
};

export type PlayerSearchCandidate = {
  id: string;
  displayName: string;
  fullName?: string;
  aliases: string[];
  primaryPosition?: string | null;
  firstYear?: number | null;
  lastYear?: number | null;
  teamsDisplay?: string;
  playerType?: string;
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
  return searchPlayerCandidates(query, players, true);
}

export function searchCanonicalPlayers(
  query: string,
  players: readonly PlayerSearchCandidate[],
): PlayerSearchResult[] {
  return searchPlayerCandidates(query, players, false);
}

function searchPlayerCandidates(
  query: string,
  players: readonly PlayerSearchCandidate[],
  collapseSameVisibleName: boolean,
): PlayerSearchResult[] {
  const normalizedQuery = normalizeGuess(query);

  if (!normalizedQuery) {
    return [];
  }

  const acceptedPlayerIdsByVisibleName = collapseSameVisibleName
    ? buildAcceptedPlayerIdsByVisibleName(players)
    : new Map<string, string[]>();
  const rankedResults = players
    .map((player) => rankPlayerSearchResult(
      normalizedQuery,
      player,
      acceptedPlayerIdsByVisibleName,
      collapseSameVisibleName,
    ))
    .filter((result): result is RankedPlayerSearchResult => result !== null)
    .sort(compareRankedResults);

  return dedupeRankedResults(rankedResults, collapseSameVisibleName)
    .slice(0, SEARCH_RESULT_LIMIT);
}

function rankPlayerSearchResult(
  query: string,
  player: PlayerSearchCandidate,
  acceptedPlayerIdsByVisibleName: Map<string, string[]>,
  collapseSameVisibleName: boolean,
): RankedPlayerSearchResult | null {
  const fullName = player.fullName ?? player.displayName;
  const searchableFields = [fullName, player.displayName, ...player.aliases].map(normalizeGuess);
  const matchIndexes = searchableFields
    .map((field) => getSearchMatchIndex(query, field))
    .filter((index): index is number => index !== null);

  if (matchIndexes.length === 0) {
    return null;
  }

  const bestIndex = Math.min(...matchIndexes);
  const metadata: NonNullable<PlayerSearchResult['metadata']> = {
    firstYear: player.firstYear ?? null,
    lastYear: player.lastYear ?? null,
    primaryPosition: player.primaryPosition ?? 'Unknown',
  };
  if (isLegacyPlayer(player)) {
    metadata.dailyEligibilityTier = player.dailyEligibilityTier;
    metadata.mainDecade = player.mainDecade;
  }
  if (player.playerType !== undefined) metadata.playerType = player.playerType;
  if (player.teamsDisplay !== undefined) metadata.teamsDisplay = player.teamsDisplay;

  return {
    playerId: player.id,
    acceptedPlayerIds: collapseSameVisibleName
      ? acceptedPlayerIdsByVisibleName.get(normalizeGuess(player.displayName)) ?? [player.id]
      : [player.id],
    displayName: player.displayName,
    fullName,
    metadata,
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

function buildAcceptedPlayerIdsByVisibleName(players: readonly PlayerSearchCandidate[]): Map<string, string[]> {
  const playersByVisibleName = new Map<string, PlayerSearchCandidate[]>();

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

function compareAcceptedPlayerIdCandidates(left: PlayerSearchCandidate, right: PlayerSearchCandidate): number {
  return (
    getCandidateEligibilityPriority(left) - getCandidateEligibilityPriority(right)
    || left.displayName.localeCompare(right.displayName)
    || (left.fullName ?? left.displayName).localeCompare(right.fullName ?? right.displayName)
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

function dedupeRankedResults(
  results: RankedPlayerSearchResult[],
  collapseSameVisibleName: boolean,
): PlayerSearchResult[] {
  const playerIdDedupedResults = dedupeBy(results, (result) => result.playerId);
  const visibleResults = collapseSameVisibleName
    ? dedupeBy(playerIdDedupedResults, (result) => normalizeGuess(result.displayName))
    : playerIdDedupedResults;
  const fullNameDedupedResults = collapseSameVisibleName
    ? dedupeBy(visibleResults, (result) => normalizeGuess(result.fullName))
    : visibleResults;

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

function getCandidateEligibilityPriority(player: PlayerSearchCandidate): number {
  if (!isLegacyPlayer(player)) {
    return ELIGIBILITY_PRIORITIES.none;
  }
  return ELIGIBILITY_PRIORITIES[player.dailyEligibilityTier];
}

function isLegacyPlayer(player: PlayerSearchCandidate): player is Player {
  return 'dailyEligibilityTier' in player && 'mainDecade' in player;
}
