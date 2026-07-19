import { describe, expect, it } from 'vitest';
import { createCanonicalPlayerId } from './canonical-identity-core.mjs';
import { buildCanonicalPlayerUniverse } from './canonical-universe-core.mjs';

function lahmanPlayer(overrides = {}) {
  return {
    playerId: 'player01',
    bbrefId: 'playerex01',
    retroId: 'playe001',
    displayName: 'Example Player',
    legalName: 'Example Middle Player',
    debutYear: 2000,
    finalYear: 2010,
    ...overrides,
  };
}

function identityPlayer(overrides = {}) {
  return {
    canonicalId: createCanonicalPlayerId('lahman:player01'),
    status: 'approved',
    displayName: 'Example Player',
    aliases: ['Example M. Player'],
    legacyPlayerIds: ['chadwick:one'],
    lahmanPlayerId: 'player01',
    sourceMappings: [
      { source: 'lahman', externalId: 'player01' },
      { source: 'legacy_player_id', externalId: 'chadwick:one' },
    ],
    firstYear: 2000,
    lastYear: 2010,
    weakLahmanCandidates: [],
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildCanonicalPlayerUniverse({
    lahmanPlayers: [lahmanPlayer()],
    inductedHallOfFamePlayerIds: new Set(),
    canonicalIdentityPlayers: [identityPlayer()],
    dispositionRecommendations: [],
    compatibilityRedirects: [],
    historicalReferenceIds: [],
    ...overrides,
  });
}

describe('Lahman-first canonical universe', () => {
  it('publishes one Lahman player with the stable app-owned ID and approved aliases', () => {
    const result = build();

    expect(result.universePlayers).toHaveLength(1);
    expect(result.universePlayers[0]).toMatchObject({
      canonicalId: createCanonicalPlayerId('lahman:player01'),
      lahmanPlayerId: 'player01',
      displayName: 'Example Player',
      legalName: 'Example Middle Player',
      legacyPlayerIds: ['chadwick:one'],
      aliases: ['Example M. Player', 'Example Middle Player'],
    });
    expect(result.identityRedirects).toEqual({
      'chadwick:one': createCanonicalPlayerId('lahman:player01'),
    });
    expect(result.report.validation.criticalIssues).toEqual([]);
  });

  it('does not publish an unresolved legacy identity as a second player', () => {
    const result = build({
      canonicalIdentityPlayers: [
        identityPlayer(),
        identityPlayer({
          canonicalId: createCanonicalPlayerId('legacy:chadwick:duplicate'),
          status: 'review',
          displayName: 'Example Player',
          legacyPlayerIds: ['chadwick:duplicate'],
          lahmanPlayerId: null,
          sourceMappings: [{ source: 'legacy_player_id', externalId: 'chadwick:duplicate' }],
          weakLahmanCandidates: [{ lahmanPlayerId: 'player01', displayName: 'Example Player' }],
        }),
      ],
      dispositionRecommendations: [{
        canonicalId: createCanonicalPlayerId('legacy:chadwick:duplicate'),
        displayName: 'Example Player',
        legacyPlayerIds: ['chadwick:duplicate'],
        recommendedDisposition: 'exclude_unverified_non_mlb',
        reason: 'No MLB evidence.',
      }],
    });

    expect(result.universePlayers).toHaveLength(1);
    expect(result.redirects['chadwick:duplicate']).toBeUndefined();
    expect(result.retiredLegacyIds).toEqual([
      expect.objectContaining({
        legacyPlayerId: 'chadwick:duplicate',
        disposition: 'exclude_unverified_non_mlb',
      }),
    ]);
  });

  it('keeps genuinely different same-name Lahman players separate', () => {
    const result = build({
      lahmanPlayers: [
        lahmanPlayer({
          playerId: 'old01',
          bbrefId: 'old01',
          retroId: 'old001',
          displayName: 'Ben Taylor',
          legalName: 'Benjamin Taylor',
          debutYear: 1920,
          finalYear: 1922,
        }),
        lahmanPlayer({
          playerId: 'new01',
          bbrefId: 'new01',
          retroId: 'new001',
          displayName: 'Ben Taylor',
          legalName: 'Benjamin Taylor',
          debutYear: 2006,
          finalYear: 2006,
        }),
      ],
      inductedHallOfFamePlayerIds: new Set(['old01']),
      canonicalIdentityPlayers: [],
    });

    expect(result.universePlayers).toHaveLength(2);
    expect(new Set(result.universePlayers.map((player) => player.canonicalId)).size).toBe(2);
    expect(result.report.duplicateDisplayNameGroups).toHaveLength(1);
    expect(result.report.validation.criticalIssues).toEqual([]);
  });

  it('keeps compatibility redirects separate from identity mappings', () => {
    const result = build({
      compatibilityRedirects: [{
        legacyPlayerId: 'chadwick:bad-historical-reference',
        targetLahmanPlayerId: 'player01',
        scope: 'historical_daily_override',
        reason: 'The old override explicitly intended Example Player.',
        reviewedBy: 'project-owner',
        reviewedAt: '2026-07-19',
      }],
      historicalReferenceIds: ['chadwick:bad-historical-reference'],
    });

    expect(result.identityRedirects['chadwick:bad-historical-reference']).toBeUndefined();
    expect(result.redirects['chadwick:bad-historical-reference']).toBe(createCanonicalPlayerId('lahman:player01'));
    expect(result.report.appliedCompatibilityRedirects).toEqual([
      expect.objectContaining({
        legacyPlayerId: 'chadwick:bad-historical-reference',
        targetLahmanPlayerId: 'player01',
        displayName: 'Example Player',
      }),
    ]);
    expect(result.historicalReferenceAudit).toEqual([
      expect.objectContaining({ resolved: true }),
    ]);
  });

  it('fails validation when a historical reference has no redirect', () => {
    const result = build({
      historicalReferenceIds: ['chadwick:missing'],
    });

    expect(result.report.validation.criticalIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'historical_player_reference_unresolved',
        legacyPlayerId: 'chadwick:missing',
      }),
    ]));
  });

  it('is deterministic regardless of input order', () => {
    const second = lahmanPlayer({
      playerId: 'second01',
      bbrefId: 'second01',
      retroId: 'secon001',
      displayName: 'Second Player',
      legalName: 'Second Middle Player',
      debutYear: 1990,
      finalYear: 1999,
    });
    const secondIdentity = identityPlayer({
      canonicalId: createCanonicalPlayerId('lahman:second01'),
      displayName: 'Second Player',
      aliases: [],
      legacyPlayerIds: ['chadwick:second'],
      lahmanPlayerId: 'second01',
      sourceMappings: [{ source: 'lahman', externalId: 'second01' }],
      firstYear: 1990,
      lastYear: 1999,
    });
    const input = {
      lahmanPlayers: [lahmanPlayer(), second],
      canonicalIdentityPlayers: [identityPlayer(), secondIdentity],
      inductedHallOfFamePlayerIds: new Set(),
      dispositionRecommendations: [],
      compatibilityRedirects: [],
      historicalReferenceIds: [],
    };

    const forward = buildCanonicalPlayerUniverse(input);
    const reversed = buildCanonicalPlayerUniverse({
      ...input,
      lahmanPlayers: [...input.lahmanPlayers].reverse(),
      canonicalIdentityPlayers: [...input.canonicalIdentityPlayers].reverse(),
    });

    expect(reversed).toEqual(forward);
  });
});
