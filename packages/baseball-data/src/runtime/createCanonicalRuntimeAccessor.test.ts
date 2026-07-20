import { describe, expect, it } from 'vitest';
import { createCanonicalRuntimeAccessor, CanonicalRuntimeDataError } from './createCanonicalRuntimeAccessor.js';
import type {
  CanonicalPlayerIndexPayload,
  CanonicalPlayerReveal,
  CanonicalRedirectPayload,
  CanonicalRevealShardPayload,
} from './types.js';

const playerId = 'ibp_ab000000000000000000';
const legacyPlayerId = 'chadwick:resolved';
const excludedLegacyPlayerId = 'chadwick:excluded';
const reveal = buildReveal(playerId);
const playerIndex: CanonicalPlayerIndexPayload = {
  schemaVersion: 1,
  players: [{
    playerId,
    lahmanPlayerId: 'sample01',
    displayName: 'Sample Player',
    aliases: ['Long Sample Player'],
    playerType: 'hitter',
    primaryPosition: '1B',
    firstSeason: 2000,
    lastSeason: 2001,
    seasonCount: 2,
    teamIds: ['AAA'],
    isHallOfFamer: false,
    revealShard: 'reveal-shards/ab.json',
  }],
};
const redirects: CanonicalRedirectPayload = {
  schemaVersion: 1,
  redirects: { [legacyPlayerId]: playerId },
  excludedRedirects: [{
    legacyPlayerId: excludedLegacyPlayerId,
    playerId: 'ibp_cd000000000000000000',
    reason: 'target_has_no_runtime_reveal',
  }],
};

describe('canonical runtime accessor', () => {
  it('resolves canonical and legacy IDs explicitly', () => {
    const accessor = createAccessor();
    expect(accessor.resolvePlayerId(playerId)).toEqual({ status: 'canonical', playerId });
    expect(accessor.resolvePlayerId(legacyPlayerId)).toEqual({
      status: 'redirected',
      playerId,
      legacyPlayerId,
    });
  });

  it('keeps excluded and unknown IDs visibly unresolved', () => {
    const accessor = createAccessor();
    expect(accessor.resolvePlayerId(excludedLegacyPlayerId)).toMatchObject({
      status: 'excluded',
      reason: 'target_has_no_runtime_reveal',
    });
    expect(accessor.resolvePlayerId('missing')).toEqual({
      status: 'unknown',
      requestedPlayerId: 'missing',
    });
    expect(() => accessor.requireCanonicalPlayerId(excludedLegacyPlayerId)).toThrow(CanonicalRuntimeDataError);
  });

  it('loads the deterministic shard and validates the requested identity', () => {
    expect(createAccessor().getReveal(legacyPlayerId)).toEqual(reveal);
  });

  it('fails safely when the shard omits the requested player', () => {
    const accessor = createCanonicalRuntimeAccessor({
      playerIndex,
      redirects,
      loadRevealShard: () => ({ schemaVersion: 1, shardId: 'ab', players: {} }),
    });
    expect(() => accessor.getReveal(playerId)).toThrow(`does not contain ${playerId}`);
  });
});

function createAccessor() {
  const shard: CanonicalRevealShardPayload = {
    schemaVersion: 1,
    shardId: 'ab',
    players: { [playerId]: reveal },
  };
  return createCanonicalRuntimeAccessor({ playerIndex, redirects, loadRevealShard: () => shard });
}

function buildReveal(canonicalPlayerId: string): CanonicalPlayerReveal {
  return {
    schemaVersion: 1,
    playerId: canonicalPlayerId,
    lahmanPlayerId: 'sample01',
    displayName: 'Sample Player',
    playerType: 'hitter',
    career: {
      firstSeason: 2000,
      lastSeason: 2001,
      seasonCount: 2,
      teamIds: ['AAA'],
      primaryPosition: '1B',
      batting: null,
      pitching: null,
      advanced: null,
      achievements: null,
    },
    seasons: [],
    provenance: {
      canonicalUniversePresent: true,
      careerEnrichmentPresent: true,
      seasonCardCount: 0,
      legalNameExcludedFromDisplayPayload: true,
    },
  };
}
