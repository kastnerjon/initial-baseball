import { createHash } from 'node:crypto';

const PLAYER_ID_NAMESPACE = 'initial-baseball-player-v1';
const ELIGIBILITY_PRIORITY = {
  core: 0,
  extended: 1,
  none: 2,
};

export function createCanonicalPlayerId(anchor) {
  const digest = createHash('sha256')
    .update(`${PLAYER_ID_NAMESPACE}:${anchor}`)
    .digest('hex')
    .slice(0, 20);

  return `ibp_${digest}`;
}

export function buildCanonicalIdentityLayer({
  legacyPlayers,
  chadwickRows,
  aliasesByPersonId = new Map(),
  lahmanPlayers,
  decisions = emptyDecisions(),
}) {
  const normalizedDecisions = normalizeDecisions(decisions);
  const legacyPlayerById = buildUniqueMap(legacyPlayers, (player) => player.id, 'legacy player ID');
  const legacyIds = new Set(legacyPlayerById.keys());
  const chadwickRowsByLegacyId = buildChadwickRowsByLegacyId(chadwickRows, legacyIds);
  const lahmanPlayerById = buildUniqueMap(lahmanPlayers, (player) => player.playerId, 'Lahman player ID');
  const graph = createIdentityGraph();
  const blockedLinks = buildBlockedLinkSet(normalizedDecisions.blockedLinks);
  const externalTokenNodes = new Map();
  const missingChadwickRows = [];
  const duplicateChadwickRows = [];

  for (const player of legacyPlayers) {
    graph.addNode(legacyNodeId(player.id));
    const rows = chadwickRowsByLegacyId.get(player.id) ?? [];

    if (rows.length === 0) {
      missingChadwickRows.push(summarizeLegacyPlayer(player));
      continue;
    }

    if (rows.length > 1) {
      duplicateChadwickRows.push({
        legacyPlayerId: player.id,
        rowCount: rows.length,
      });
    }

    for (const row of rows) {
      for (const token of getChadwickExternalTokens(row, blockedLinks, player.id)) {
        addTokenNode(externalTokenNodes, token, legacyNodeId(player.id));
      }
    }
  }

  for (const player of lahmanPlayers) {
    graph.addNode(lahmanNodeId(player.playerId));

    for (const token of getLahmanExternalTokens(player)) {
      addTokenNode(externalTokenNodes, token, lahmanNodeId(player.playerId));
    }
  }

  for (const nodes of externalTokenNodes.values()) {
    unionAll(graph, nodes);
  }

  for (const mapping of normalizedDecisions.forcedMappings) {
    const legacyNode = legacyNodeId(mapping.legacyPlayerId);

    if (!legacyIds.has(mapping.legacyPlayerId)) {
      continue;
    }

    if (mapping.lahmanPlayerId) {
      const lahmanNode = lahmanNodeId(mapping.lahmanPlayerId);
      if (lahmanPlayerById.has(mapping.lahmanPlayerId)) {
        graph.union(legacyNode, lahmanNode);
      }
    }

    if (mapping.canonicalGroup) {
      const groupNode = decisionNodeId(mapping.canonicalGroup);
      graph.addNode(groupNode);
      graph.union(legacyNode, groupNode);
    }
  }

  const components = graph.components();
  const forcedMappingByLegacyId = new Map(
    normalizedDecisions.forcedMappings.map((mapping) => [mapping.legacyPlayerId, mapping]),
  );
  const displayNameOverrideByCanonicalId = new Map(
    normalizedDecisions.displayNameOverrides.map((override) => [override.canonicalId, override.displayName]),
  );
  const canonicalPlayers = [];
  const redirects = {};
  const conflicts = [];
  const reviewQueue = [];
  const mergedLegacyGroups = [];
  const sourceMappingConflicts = [];

  for (const componentNodes of components) {
    const componentLegacyIds = componentNodes
      .filter((node) => node.startsWith('legacy:'))
      .map((node) => node.slice('legacy:'.length))
      .sort();

    if (componentLegacyIds.length === 0) {
      continue;
    }

    const componentLahmanIds = componentNodes
      .filter((node) => node.startsWith('lahman:'))
      .map((node) => node.slice('lahman:'.length))
      .sort();

    if (componentLahmanIds.length > 1) {
      const conflict = {
        type: 'multiple_lahman_players_in_component',
        legacyPlayerIds: componentLegacyIds,
        lahmanPlayerIds: componentLahmanIds,
      };
      conflicts.push(conflict);
      sourceMappingConflicts.push(conflict);

      for (const legacyPlayerId of componentLegacyIds) {
        const isolated = buildIsolatedReviewPlayer({
          legacyPlayerId,
          legacyPlayerById,
          chadwickRowsByLegacyId,
          aliasesByPersonId,
          forcedMappingByLegacyId,
        });
        canonicalPlayers.push(isolated.player);
        redirects[legacyPlayerId] = isolated.player.canonicalId;
        reviewQueue.push(isolated.reviewEntry);
      }

      continue;
    }

    const lahmanPlayer = componentLahmanIds.length === 1
      ? lahmanPlayerById.get(componentLahmanIds[0]) ?? null
      : null;
    const forcedCanonicalIds = [...new Set(componentLegacyIds
      .map((legacyPlayerId) => forcedMappingByLegacyId.get(legacyPlayerId)?.canonicalId)
      .filter(Boolean))]
      .sort();

    if (forcedCanonicalIds.length > 1) {
      conflicts.push({
        type: 'multiple_forced_canonical_ids_in_component',
        legacyPlayerIds: componentLegacyIds,
        canonicalIds: forcedCanonicalIds,
      });
    }

    const anchor = chooseCanonicalAnchor({
      componentLegacyIds,
      lahmanPlayer,
      componentNodes,
    });
    const canonicalId = forcedCanonicalIds[0] ?? createCanonicalPlayerId(anchor);
    const legacyPlayerRows = componentLegacyIds
      .map((legacyPlayerId) => legacyPlayerById.get(legacyPlayerId))
      .filter(Boolean);
    const componentChadwickRows = componentLegacyIds
      .flatMap((legacyPlayerId) => chadwickRowsByLegacyId.get(legacyPlayerId) ?? []);
    const defaultDisplayName = lahmanPlayer?.displayName
      || choosePreferredLegacyPlayer(legacyPlayerRows)?.displayName
      || choosePreferredLegacyPlayer(legacyPlayerRows)?.fullName
      || canonicalId;
    const displayName = displayNameOverrideByCanonicalId.get(canonicalId) ?? defaultDisplayName;
    const status = lahmanPlayer ? 'approved' : componentLegacyIds.length > 1 ? 'review' : 'review';
    const aliases = collectAliases({
      displayName,
      lahmanPlayer,
      legacyPlayers: legacyPlayerRows,
      chadwickRows: componentChadwickRows,
      aliasesByPersonId,
    });
    const sourceMappings = collectSourceMappings({
      lahmanPlayer,
      legacyPlayerIds: componentLegacyIds,
      chadwickRows: componentChadwickRows,
    });
    const weakLahmanCandidates = lahmanPlayer
      ? []
      : findWeakLahmanCandidates({
        legacyPlayers: legacyPlayerRows,
        chadwickRows: componentChadwickRows,
        lahmanPlayers,
      });
    const player = {
      canonicalId,
      status,
      displayName,
      aliases,
      legacyPlayerIds: componentLegacyIds,
      lahmanPlayerId: lahmanPlayer?.playerId ?? null,
      sourceMappings,
      firstYear: lahmanPlayer?.debutYear ?? deriveFirstYear(legacyPlayerRows),
      lastYear: lahmanPlayer?.finalYear ?? deriveLastYear(legacyPlayerRows),
      weakLahmanCandidates,
    };

    canonicalPlayers.push(player);

    for (const legacyPlayerId of componentLegacyIds) {
      redirects[legacyPlayerId] = canonicalId;
    }

    if (componentLegacyIds.length > 1) {
      mergedLegacyGroups.push({
        canonicalId,
        displayName,
        legacyPlayerIds: componentLegacyIds,
        lahmanPlayerId: lahmanPlayer?.playerId ?? null,
      });
    }

    if (status !== 'approved' || weakLahmanCandidates.length > 0) {
      reviewQueue.push({
        canonicalId,
        displayName,
        reason: lahmanPlayer
          ? 'manual_review'
          : componentLegacyIds.length > 1
            ? 'strong_external_identity_without_lahman_match'
            : weakLahmanCandidates.length > 0
              ? 'weak_name_year_candidate'
              : 'unmatched_identity',
        legacyPlayerIds: componentLegacyIds,
        weakLahmanCandidates,
      });
    }
  }

  canonicalPlayers.sort(compareCanonicalPlayers);
  reviewQueue.sort(compareReviewEntries);
  mergedLegacyGroups.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

  const duplicateCanonicalDisplayNames = findDuplicateCanonicalDisplayNames(canonicalPlayers);
  const validation = validateCanonicalIdentityLayer({
    canonicalPlayers,
    redirects,
    legacyPlayers,
    conflicts,
    missingChadwickRows,
    duplicateChadwickRows,
  });

  return {
    canonicalPlayers,
    redirects: sortObject(redirects),
    reviewQueue,
    report: {
      summary: {
        legacyPlayerCount: legacyPlayers.length,
        canonicalPlayerCount: canonicalPlayers.length,
        approvedCanonicalPlayerCount: canonicalPlayers.filter((player) => player.status === 'approved').length,
        reviewCanonicalPlayerCount: canonicalPlayers.filter((player) => player.status === 'review').length,
        mergedLegacyGroupCount: mergedLegacyGroups.length,
        redirectedLegacyPlayerCount: Object.keys(redirects).length,
        duplicateCanonicalDisplayNameGroupCount: duplicateCanonicalDisplayNames.length,
        weakCandidateCount: canonicalPlayers.filter((player) => player.weakLahmanCandidates.length > 0).length,
        conflictCount: conflicts.length,
        criticalIssueCount: validation.criticalIssues.length,
      },
      mergedLegacyGroups,
      duplicateCanonicalDisplayNames,
      reviewQueue,
      conflicts,
      missingChadwickRows,
      duplicateChadwickRows,
      sourceMappingConflicts,
      validation,
    },
  };
}

export function validateCanonicalIdentityLayer({
  canonicalPlayers,
  redirects,
  legacyPlayers,
  conflicts = [],
  missingChadwickRows = [],
  duplicateChadwickRows = [],
}) {
  const criticalIssues = [];
  const canonicalIds = new Set();
  const sourceMappingOwners = new Map();

  for (const player of canonicalPlayers) {
    if (canonicalIds.has(player.canonicalId)) {
      criticalIssues.push({
        type: 'duplicate_canonical_id',
        canonicalId: player.canonicalId,
      });
    }
    canonicalIds.add(player.canonicalId);

    for (const mapping of player.sourceMappings) {
      const key = `${mapping.source}:${mapping.externalId}`;
      const existingOwner = sourceMappingOwners.get(key);

      if (existingOwner && existingOwner !== player.canonicalId) {
        criticalIssues.push({
          type: 'external_id_maps_to_multiple_canonical_players',
          source: mapping.source,
          externalId: mapping.externalId,
          canonicalIds: [existingOwner, player.canonicalId].sort(),
        });
      } else {
        sourceMappingOwners.set(key, player.canonicalId);
      }
    }
  }

  for (const player of legacyPlayers) {
    const target = redirects[player.id];

    if (!target) {
      criticalIssues.push({
        type: 'legacy_player_missing_redirect',
        legacyPlayerId: player.id,
      });
      continue;
    }

    if (!canonicalIds.has(target)) {
      criticalIssues.push({
        type: 'legacy_redirect_target_missing',
        legacyPlayerId: player.id,
        canonicalId: target,
      });
    }
  }

  for (const conflict of conflicts) {
    criticalIssues.push(conflict);
  }

  for (const duplicate of duplicateChadwickRows) {
    criticalIssues.push({
      type: 'duplicate_chadwick_rows_for_legacy_player',
      ...duplicate,
    });
  }

  return {
    criticalIssues: dedupeObjects(criticalIssues),
    warnings: missingChadwickRows.map((player) => ({
      type: 'missing_chadwick_row_for_legacy_player',
      ...player,
    })),
  };
}

export function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildChadwickRowsByLegacyId(rows, legacyIds) {
  const result = new Map();

  for (const row of rows) {
    const legacyPlayerId = row.legacyPlayerId || (row.key_person ? `chadwick:${row.key_person}` : '');

    if (!legacyPlayerId || !legacyIds.has(legacyPlayerId)) {
      continue;
    }

    const matches = result.get(legacyPlayerId) ?? [];
    matches.push(row);
    result.set(legacyPlayerId, matches);
  }

  return result;
}

function buildUniqueMap(rows, getKey, label) {
  const result = new Map();

  for (const row of rows) {
    const key = getKey(row);

    if (!key) {
      continue;
    }

    if (result.has(key)) {
      throw new Error(`Duplicate ${label}: ${key}`);
    }

    result.set(key, row);
  }

  return result;
}

function buildBlockedLinkSet(blockedLinks) {
  return new Set(blockedLinks.map((link) => `${link.legacyPlayerId}|${link.source}|${link.externalId}`));
}

function getChadwickExternalTokens(row, blockedLinks, legacyPlayerId) {
  const mappings = [
    ['chadwick_uuid', row.key_uuid],
    ['bbref', row.key_bbref],
    ['retro', row.key_retro],
    ['mlbam', row.key_mlbam],
  ];

  return mappings
    .map(([source, value]) => [source, String(value ?? '').trim()])
    .filter(([, value]) => value)
    .filter(([source, value]) => !blockedLinks.has(`${legacyPlayerId}|${source}|${value}`))
    .map(([source, value]) => `${source}:${value}`);
}

function getLahmanExternalTokens(player) {
  return [
    player.bbrefId ? `bbref:${player.bbrefId}` : '',
    player.retroId ? `retro:${player.retroId}` : '',
  ].filter(Boolean);
}

function addTokenNode(tokenNodes, token, node) {
  const nodes = tokenNodes.get(token) ?? new Set();
  nodes.add(node);
  tokenNodes.set(token, nodes);
}

function unionAll(graph, nodes) {
  const values = [...nodes].sort();
  const first = values[0];

  if (!first) {
    return;
  }

  for (const node of values.slice(1)) {
    graph.union(first, node);
  }
}

function createIdentityGraph() {
  const parent = new Map();
  const rank = new Map();

  function addNode(node) {
    if (!parent.has(node)) {
      parent.set(node, node);
      rank.set(node, 0);
    }
  }

  function find(node) {
    addNode(node);
    const currentParent = parent.get(node);

    if (currentParent === node) {
      return node;
    }

    const root = find(currentParent);
    parent.set(node, root);
    return root;
  }

  function union(left, right) {
    const leftRoot = find(left);
    const rightRoot = find(right);

    if (leftRoot === rightRoot) {
      return;
    }

    const leftRank = rank.get(leftRoot) ?? 0;
    const rightRank = rank.get(rightRoot) ?? 0;

    if (leftRank < rightRank) {
      parent.set(leftRoot, rightRoot);
      return;
    }

    if (leftRank > rightRank) {
      parent.set(rightRoot, leftRoot);
      return;
    }

    parent.set(rightRoot, leftRoot);
    rank.set(leftRoot, leftRank + 1);
  }

  function components() {
    const groups = new Map();

    for (const node of [...parent.keys()].sort()) {
      const root = find(node);
      const values = groups.get(root) ?? [];
      values.push(node);
      groups.set(root, values);
    }

    return [...groups.values()]
      .map((values) => values.sort())
      .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  }

  return {
    addNode,
    union,
    components,
  };
}

function chooseCanonicalAnchor({ componentLegacyIds, lahmanPlayer, componentNodes }) {
  if (lahmanPlayer) {
    return `lahman:${lahmanPlayer.playerId}`;
  }

  const decisionGroup = componentNodes
    .filter((node) => node.startsWith('decision:'))
    .map((node) => node.slice('decision:'.length))
    .sort()[0];

  if (decisionGroup) {
    return `decision:${decisionGroup}`;
  }

  return `legacy:${componentLegacyIds[0]}`;
}

function buildIsolatedReviewPlayer({
  legacyPlayerId,
  legacyPlayerById,
  chadwickRowsByLegacyId,
  aliasesByPersonId,
  forcedMappingByLegacyId,
}) {
  const legacyPlayer = legacyPlayerById.get(legacyPlayerId);
  const chadwickRows = chadwickRowsByLegacyId.get(legacyPlayerId) ?? [];
  const forcedMapping = forcedMappingByLegacyId.get(legacyPlayerId);
  const canonicalId = forcedMapping?.canonicalId ?? createCanonicalPlayerId(`conflict:${legacyPlayerId}`);
  const displayName = legacyPlayer?.displayName || legacyPlayer?.fullName || canonicalId;
  const player = {
    canonicalId,
    status: 'review',
    displayName,
    aliases: collectAliases({
      displayName,
      lahmanPlayer: null,
      legacyPlayers: legacyPlayer ? [legacyPlayer] : [],
      chadwickRows,
      aliasesByPersonId,
    }),
    legacyPlayerIds: [legacyPlayerId],
    lahmanPlayerId: null,
    sourceMappings: collectSourceMappings({
      lahmanPlayer: null,
      legacyPlayerIds: [legacyPlayerId],
      chadwickRows,
    }),
    firstYear: legacyPlayer?.firstYear ?? null,
    lastYear: legacyPlayer?.lastYear ?? null,
    weakLahmanCandidates: [],
  };

  return {
    player,
    reviewEntry: {
      canonicalId,
      displayName,
      reason: 'conflicting_strong_identity_links',
      legacyPlayerIds: [legacyPlayerId],
      weakLahmanCandidates: [],
    },
  };
}

function collectAliases({
  displayName,
  lahmanPlayer,
  legacyPlayers,
  chadwickRows,
  aliasesByPersonId,
}) {
  const aliases = new Set();

  for (const name of [lahmanPlayer?.legalName, ...legacyPlayers.flatMap((player) => [player.displayName, player.fullName, ...(player.aliases ?? [])])]) {
    addAlias(aliases, name, displayName);
  }

  for (const row of chadwickRows) {
    for (const name of [formatChadwickCommonName(row), formatChadwickLegalName(row), ...(aliasesByPersonId.get(row.key_person) ?? [])]) {
      addAlias(aliases, name, displayName);
    }
  }

  return [...aliases].sort((left, right) => normalizeName(left).localeCompare(normalizeName(right)) || left.localeCompare(right));
}

function addAlias(aliases, value, displayName) {
  const name = String(value ?? '').trim();

  if (!name || normalizeName(name) === normalizeName(displayName)) {
    return;
  }

  aliases.add(name);
}

function collectSourceMappings({ lahmanPlayer, legacyPlayerIds, chadwickRows }) {
  const mappings = [];

  if (lahmanPlayer) {
    mappings.push({ source: 'lahman', externalId: lahmanPlayer.playerId });
    if (lahmanPlayer.bbrefId) mappings.push({ source: 'bbref', externalId: lahmanPlayer.bbrefId });
    if (lahmanPlayer.retroId) mappings.push({ source: 'retro', externalId: lahmanPlayer.retroId });
  }

  for (const legacyPlayerId of legacyPlayerIds) {
    mappings.push({ source: 'legacy_player_id', externalId: legacyPlayerId });
  }

  for (const row of chadwickRows) {
    for (const [source, value] of [
      ['chadwick_person', row.key_person],
      ['chadwick_uuid', row.key_uuid],
      ['bbref', row.key_bbref],
      ['retro', row.key_retro],
      ['mlbam', row.key_mlbam],
    ]) {
      const externalId = String(value ?? '').trim();
      if (externalId) mappings.push({ source, externalId });
    }
  }

  return dedupeObjects(mappings)
    .sort((left, right) => left.source.localeCompare(right.source) || left.externalId.localeCompare(right.externalId));
}

function findWeakLahmanCandidates({ legacyPlayers, chadwickRows, lahmanPlayers }) {
  const sourceNames = new Set([
    ...legacyPlayers.flatMap((player) => [player.displayName, player.fullName]),
    ...chadwickRows.flatMap((row) => [formatChadwickCommonName(row), formatChadwickLegalName(row)]),
  ].map(normalizeName).filter(Boolean));
  const firstYear = deriveFirstYear(legacyPlayers);
  const lastYear = deriveLastYear(legacyPlayers);

  return lahmanPlayers
    .filter((player) => [player.displayName, player.legalName].map(normalizeName).some((name) => sourceNames.has(name)))
    .filter((player) => careerRangesCompatible(firstYear, lastYear, player.debutYear, player.finalYear))
    .map((player) => ({
      lahmanPlayerId: player.playerId,
      displayName: player.displayName,
      debutYear: player.debutYear,
      finalYear: player.finalYear,
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.lahmanPlayerId.localeCompare(right.lahmanPlayerId));
}

function careerRangesCompatible(leftFirst, leftLast, rightFirst, rightLast) {
  if (![leftFirst, leftLast, rightFirst, rightLast].every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return true;
  }

  const tolerance = 2;
  return leftFirst <= rightLast + tolerance && rightFirst <= leftLast + tolerance;
}

function findDuplicateCanonicalDisplayNames(players) {
  const groups = new Map();

  for (const player of players) {
    const key = normalizeName(player.displayName);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push({
      canonicalId: player.canonicalId,
      displayName: player.displayName,
      status: player.status,
      lahmanPlayerId: player.lahmanPlayerId,
      firstYear: player.firstYear,
      lastYear: player.lastYear,
      legacyPlayerIds: player.legacyPlayerIds,
    });
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedDisplayName, group]) => ({
      normalizedDisplayName,
      players: group.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId)),
    }))
    .sort((left, right) => left.normalizedDisplayName.localeCompare(right.normalizedDisplayName));
}

function choosePreferredLegacyPlayer(players) {
  return [...players].sort((left, right) => (
    (ELIGIBILITY_PRIORITY[left.dailyEligibilityTier] ?? 9) - (ELIGIBILITY_PRIORITY[right.dailyEligibilityTier] ?? 9)
    || tokenize(left.displayName).length - tokenize(right.displayName).length
    || String(left.displayName).localeCompare(String(right.displayName))
    || String(left.id).localeCompare(String(right.id))
  ))[0] ?? null;
}

function deriveFirstYear(players) {
  const years = players.map((player) => player.firstYear).filter(isFiniteNumber);
  return years.length > 0 ? Math.min(...years) : null;
}

function deriveLastYear(players) {
  const years = players.map((player) => player.lastYear).filter(isFiniteNumber);
  return years.length > 0 ? Math.max(...years) : null;
}

function formatChadwickCommonName(row) {
  return formatName({
    first: row.name_first || row.name_given,
    last: row.name_matrilineal ? `${row.name_matrilineal} ${row.name_last}` : row.name_last,
    suffix: row.name_suffix,
  });
}

function formatChadwickLegalName(row) {
  return formatName({
    first: row.name_given,
    last: row.name_last,
    suffix: row.name_suffix,
  });
}

function formatName({ first, last, suffix }) {
  return [first, last, suffix].map((value) => String(value ?? '').trim()).filter(Boolean).join(' ');
}

function normalizeDecisions(decisions) {
  return {
    schemaVersion: decisions?.schemaVersion ?? 1,
    forcedMappings: Array.isArray(decisions?.forcedMappings) ? decisions.forcedMappings : [],
    blockedLinks: Array.isArray(decisions?.blockedLinks) ? decisions.blockedLinks : [],
    displayNameOverrides: Array.isArray(decisions?.displayNameOverrides) ? decisions.displayNameOverrides : [],
  };
}

function emptyDecisions() {
  return {
    schemaVersion: 1,
    forcedMappings: [],
    blockedLinks: [],
    displayNameOverrides: [],
  };
}

function legacyNodeId(id) {
  return `legacy:${id}`;
}

function lahmanNodeId(id) {
  return `lahman:${id}`;
}

function decisionNodeId(id) {
  return `decision:${id}`;
}

function summarizeLegacyPlayer(player) {
  return {
    id: player.id,
    displayName: player.displayName,
    fullName: player.fullName,
    firstYear: player.firstYear,
    lastYear: player.lastYear,
  };
}

function compareCanonicalPlayers(left, right) {
  return left.displayName.localeCompare(right.displayName) || left.canonicalId.localeCompare(right.canonicalId);
}

function compareReviewEntries(left, right) {
  return left.reason.localeCompare(right.reason)
    || left.displayName.localeCompare(right.displayName)
    || left.canonicalId.localeCompare(right.canonicalId);
}

function tokenize(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function dedupeObjects(values) {
  const selected = new Map();

  for (const value of values) {
    const key = JSON.stringify(sortObject(value));
    selected.set(key, value);
  }

  return [...selected.values()];
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
  }

  return value;
}
