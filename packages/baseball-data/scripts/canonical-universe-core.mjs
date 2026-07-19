import { createCanonicalPlayerId, normalizeName } from './canonical-identity-core.mjs';

const ELIGIBILITY_START_YEAR = 1950;

export function buildCanonicalPlayerUniverse({
  lahmanPlayers,
  inductedHallOfFamePlayerIds = new Set(),
  canonicalIdentityPlayers = [],
  dispositionRecommendations = [],
  compatibilityRedirects = [],
  historicalReferenceIds = [],
}) {
  buildUniqueMap(lahmanPlayers, (player) => player.playerId, 'Lahman player ID');
  const approvedIdentityByLahmanId = new Map();
  const validationIssues = [];

  for (const identity of canonicalIdentityPlayers) {
    if (identity.status !== 'approved' || !identity.lahmanPlayerId) {
      continue;
    }

    const existing = approvedIdentityByLahmanId.get(identity.lahmanPlayerId);
    if (existing && existing.canonicalId !== identity.canonicalId) {
      validationIssues.push({
        type: 'multiple_approved_identities_for_lahman_player',
        lahmanPlayerId: identity.lahmanPlayerId,
        canonicalIds: [existing.canonicalId, identity.canonicalId].sort(),
      });
      continue;
    }

    approvedIdentityByLahmanId.set(identity.lahmanPlayerId, identity);
  }

  const universePlayers = lahmanPlayers
    .filter((player) => isEligibleLahmanPlayer(player, inductedHallOfFamePlayerIds))
    .map((lahmanPlayer) => buildUniversePlayer({
      lahmanPlayer,
      identity: approvedIdentityByLahmanId.get(lahmanPlayer.playerId) ?? null,
      isHallOfFamer: inductedHallOfFamePlayerIds.has(lahmanPlayer.playerId),
    }))
    .sort(compareUniversePlayers);

  const universePlayerByCanonicalId = new Map();
  const universePlayerByLahmanId = new Map();
  const sourceMappingOwners = new Map();

  for (const player of universePlayers) {
    if (universePlayerByCanonicalId.has(player.canonicalId)) {
      validationIssues.push({
        type: 'duplicate_canonical_id_in_universe',
        canonicalId: player.canonicalId,
      });
    }
    universePlayerByCanonicalId.set(player.canonicalId, player);

    if (universePlayerByLahmanId.has(player.lahmanPlayerId)) {
      validationIssues.push({
        type: 'duplicate_lahman_player_in_universe',
        lahmanPlayerId: player.lahmanPlayerId,
      });
    }
    universePlayerByLahmanId.set(player.lahmanPlayerId, player);

    for (const mapping of player.sourceMappings) {
      const key = `${mapping.source}:${mapping.externalId}`;
      const owner = sourceMappingOwners.get(key);
      if (owner && owner !== player.canonicalId) {
        validationIssues.push({
          type: 'external_id_maps_to_multiple_universe_players',
          source: mapping.source,
          externalId: mapping.externalId,
          canonicalIds: [owner, player.canonicalId].sort(),
        });
      } else {
        sourceMappingOwners.set(key, player.canonicalId);
      }
    }
  }

  const identityRedirects = {};
  for (const player of universePlayers) {
    for (const legacyPlayerId of player.legacyPlayerIds) {
      setRedirect({
        redirects: identityRedirects,
        legacyPlayerId,
        canonicalId: player.canonicalId,
        conflictType: 'legacy_identity_redirect_conflict',
        validationIssues,
      });
    }
  }

  const redirects = { ...identityRedirects };
  const appliedCompatibilityRedirects = [];
  const redundantCompatibilityRedirects = [];

  for (const redirect of normalizeCompatibilityRedirects(compatibilityRedirects)) {
    const target = universePlayerByLahmanId.get(redirect.targetLahmanPlayerId);

    if (!target) {
      validationIssues.push({
        type: 'compatibility_redirect_target_not_in_universe',
        legacyPlayerId: redirect.legacyPlayerId,
        targetLahmanPlayerId: redirect.targetLahmanPlayerId,
      });
      continue;
    }

    const existingTarget = redirects[redirect.legacyPlayerId];
    if (existingTarget && existingTarget !== target.canonicalId) {
      validationIssues.push({
        type: 'compatibility_redirect_conflicts_with_identity_redirect',
        legacyPlayerId: redirect.legacyPlayerId,
        identityCanonicalId: existingTarget,
        compatibilityCanonicalId: target.canonicalId,
      });
      continue;
    }

    if (existingTarget === target.canonicalId) {
      redundantCompatibilityRedirects.push({
        ...redirect,
        canonicalId: target.canonicalId,
      });
      continue;
    }

    redirects[redirect.legacyPlayerId] = target.canonicalId;
    appliedCompatibilityRedirects.push({
      ...redirect,
      canonicalId: target.canonicalId,
      displayName: target.displayName,
    });
  }

  const unresolvedLegacyDispositionEntries = buildUnresolvedLegacyDispositionEntries({
    dispositionRecommendations,
    redirects,
  });
  const retiredLegacyIds = unresolvedLegacyDispositionEntries
    .filter((entry) => entry.disposition === 'exclude_unverified_non_mlb');
  const unresolvedReviewLegacyIds = unresolvedLegacyDispositionEntries
    .filter((entry) => entry.disposition !== 'exclude_unverified_non_mlb');
  const historicalReferenceAudit = [...new Set(historicalReferenceIds)].sort().map((legacyPlayerId) => ({
    legacyPlayerId,
    canonicalId: redirects[legacyPlayerId] ?? null,
    resolved: Boolean(redirects[legacyPlayerId]),
  }));

  for (const reference of historicalReferenceAudit) {
    if (!reference.resolved) {
      validationIssues.push({
        type: 'historical_player_reference_unresolved',
        legacyPlayerId: reference.legacyPlayerId,
      });
    }
  }

  const duplicateDisplayNameGroups = findDuplicateDisplayNameGroups(universePlayers);
  const reviewCandidatesNotPublished = canonicalIdentityPlayers
    .filter((player) => player.status !== 'approved')
    .map((player) => ({
      canonicalId: player.canonicalId,
      displayName: player.displayName,
      legacyPlayerIds: [...player.legacyPlayerIds].sort(),
      weakLahmanCandidates: [...(player.weakLahmanCandidates ?? [])],
    }))
    .sort(compareReviewCandidates);
  const universePlayersWithoutLegacyIdentity = universePlayers
    .filter((player) => player.legacyPlayerIds.length === 0)
    .map((player) => ({
      canonicalId: player.canonicalId,
      lahmanPlayerId: player.lahmanPlayerId,
      displayName: player.displayName,
      firstYear: player.firstYear,
      lastYear: player.lastYear,
    }))
    .sort(compareUniversePlayers);

  const validation = {
    criticalIssues: dedupeObjects(validationIssues),
    warnings: [],
  };

  return {
    universePlayers,
    redirects: sortObject(redirects),
    identityRedirects: sortObject(identityRedirects),
    retiredLegacyIds,
    unresolvedReviewLegacyIds,
    historicalReferenceAudit,
    report: {
      summary: {
        lahmanPlayerCount: lahmanPlayers.length,
        eligibleCanonicalPlayerCount: universePlayers.length,
        playersWithStrongLegacyIdentityCount: universePlayers.filter((player) => player.legacyPlayerIds.length > 0).length,
        playersWithoutLegacyIdentityCount: universePlayersWithoutLegacyIdentity.length,
        identityRedirectCount: Object.keys(identityRedirects).length,
        compatibilityRedirectCount: appliedCompatibilityRedirects.length,
        redundantCompatibilityRedirectCount: redundantCompatibilityRedirects.length,
        retiredLegacyIdCount: retiredLegacyIds.length,
        unresolvedReviewLegacyIdCount: unresolvedReviewLegacyIds.length,
        reviewCandidateCount: reviewCandidatesNotPublished.length,
        duplicateDisplayNameGroupCount: duplicateDisplayNameGroups.length,
        historicalReferenceCount: historicalReferenceAudit.length,
        unresolvedHistoricalReferenceCount: historicalReferenceAudit.filter((reference) => !reference.resolved).length,
        criticalIssueCount: validation.criticalIssues.length,
      },
      duplicateDisplayNameGroups,
      appliedCompatibilityRedirects,
      redundantCompatibilityRedirects,
      retiredLegacyIds,
      unresolvedReviewLegacyIds,
      historicalReferenceAudit,
      reviewCandidatesNotPublished,
      universePlayersWithoutLegacyIdentity,
      validation,
    },
  };
}

export function isEligibleLahmanPlayer(player, inductedHallOfFamePlayerIds = new Set()) {
  if (inductedHallOfFamePlayerIds.has(player.playerId)) {
    return true;
  }

  const firstYear = player.debutYear;
  const lastYear = player.finalYear;
  return (Number.isInteger(firstYear) && firstYear >= ELIGIBILITY_START_YEAR)
    || (Number.isInteger(lastYear) && lastYear >= ELIGIBILITY_START_YEAR);
}

function buildUniversePlayer({ lahmanPlayer, identity, isHallOfFamer }) {
  const canonicalId = identity?.canonicalId ?? createCanonicalPlayerId(`lahman:${lahmanPlayer.playerId}`);
  const displayName = identity?.displayName || lahmanPlayer.displayName || lahmanPlayer.legalName || canonicalId;
  const legalName = lahmanPlayer.legalName || displayName;
  const aliases = uniqueNames([
    legalName,
    ...(identity?.aliases ?? []),
  ], displayName);
  const sourceMappings = uniqueSourceMappings([
    { source: 'lahman', externalId: lahmanPlayer.playerId },
    ...(lahmanPlayer.bbrefId ? [{ source: 'bbref', externalId: lahmanPlayer.bbrefId }] : []),
    ...(lahmanPlayer.retroId ? [{ source: 'retro', externalId: lahmanPlayer.retroId }] : []),
    ...(identity?.sourceMappings ?? []),
  ]);

  return {
    canonicalId,
    status: 'approved',
    lahmanPlayerId: lahmanPlayer.playerId,
    displayName,
    legalName,
    aliases,
    firstYear: lahmanPlayer.debutYear,
    lastYear: lahmanPlayer.finalYear,
    isHallOfFamer,
    legacyPlayerIds: [...(identity?.legacyPlayerIds ?? [])].sort(),
    sourceMappings,
  };
}

function buildUnresolvedLegacyDispositionEntries({ dispositionRecommendations, redirects }) {
  return dispositionRecommendations
    .flatMap((recommendation) => (recommendation.legacyPlayerIds ?? []).map((legacyPlayerId) => ({
      legacyPlayerId,
      canonicalCandidateId: recommendation.canonicalId ?? null,
      displayName: recommendation.displayName ?? '',
      disposition: recommendation.disposition ?? recommendation.recommendedDisposition,
      reason: recommendation.reason ?? '',
    })))
    .filter((entry) => !redirects[entry.legacyPlayerId])
    .sort((left, right) => left.legacyPlayerId.localeCompare(right.legacyPlayerId));
}

function findDuplicateDisplayNameGroups(players) {
  const groups = new Map();

  for (const player of players) {
    const key = normalizeName(player.displayName);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push({
      canonicalId: player.canonicalId,
      lahmanPlayerId: player.lahmanPlayerId,
      displayName: player.displayName,
      firstYear: player.firstYear,
      lastYear: player.lastYear,
    });
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedDisplayName, group]) => ({
      normalizedDisplayName,
      players: group.sort(compareUniversePlayers),
    }))
    .sort((left, right) => left.normalizedDisplayName.localeCompare(right.normalizedDisplayName));
}

function normalizeCompatibilityRedirects(redirects) {
  return [...redirects]
    .filter((redirect) => redirect && redirect.legacyPlayerId && redirect.targetLahmanPlayerId)
    .map((redirect) => ({
      legacyPlayerId: String(redirect.legacyPlayerId),
      targetLahmanPlayerId: String(redirect.targetLahmanPlayerId),
      scope: String(redirect.scope ?? 'legacy_reference'),
      reason: String(redirect.reason ?? ''),
      reviewedBy: String(redirect.reviewedBy ?? ''),
      reviewedAt: String(redirect.reviewedAt ?? ''),
    }))
    .sort((left, right) => left.legacyPlayerId.localeCompare(right.legacyPlayerId));
}

function setRedirect({ redirects, legacyPlayerId, canonicalId, conflictType, validationIssues }) {
  const existing = redirects[legacyPlayerId];
  if (existing && existing !== canonicalId) {
    validationIssues.push({
      type: conflictType,
      legacyPlayerId,
      canonicalIds: [existing, canonicalId].sort(),
    });
    return;
  }
  redirects[legacyPlayerId] = canonicalId;
}

function uniqueNames(values, excludedName) {
  const excluded = normalizeName(excludedName);
  const byNormalizedName = new Map();

  for (const value of values) {
    const name = String(value ?? '').trim();
    const normalized = normalizeName(name);
    if (!normalized || normalized === excluded) continue;
    const current = byNormalizedName.get(normalized);
    if (!current || name.length < current.length || (name.length === current.length && name.localeCompare(current) < 0)) {
      byNormalizedName.set(normalized, name);
    }
  }

  return [...byNormalizedName.values()].sort((left, right) => (
    normalizeName(left).localeCompare(normalizeName(right)) || left.localeCompare(right)
  ));
}

function uniqueSourceMappings(mappings) {
  const result = new Map();
  for (const mapping of mappings) {
    const source = String(mapping?.source ?? '').trim();
    const externalId = String(mapping?.externalId ?? '').trim();
    if (!source || !externalId) continue;
    result.set(`${source}:${externalId}`, { source, externalId });
  }
  return [...result.values()].sort((left, right) => (
    left.source.localeCompare(right.source) || left.externalId.localeCompare(right.externalId)
  ));
}

function buildUniqueMap(rows, getKey, label) {
  const result = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    if (result.has(key)) {
      throw new Error(`Duplicate ${label}: ${key}`);
    }
    result.set(key, row);
  }
  return result;
}

function compareUniversePlayers(left, right) {
  return normalizeName(left.displayName).localeCompare(normalizeName(right.displayName))
    || String(left.firstYear ?? '').localeCompare(String(right.firstYear ?? ''))
    || String(left.lahmanPlayerId ?? '').localeCompare(String(right.lahmanPlayerId ?? ''))
    || String(left.canonicalId ?? '').localeCompare(String(right.canonicalId ?? ''));
}

function compareReviewCandidates(left, right) {
  return normalizeName(left.displayName).localeCompare(normalizeName(right.displayName))
    || left.canonicalId.localeCompare(right.canonicalId);
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function dedupeObjects(values) {
  const byJson = new Map();
  for (const value of values) {
    byJson.set(JSON.stringify(sortObjectDeep(value)), value);
  }
  return [...byJson.values()].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) return value.map(sortObjectDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sortObjectDeep(item)]));
}
