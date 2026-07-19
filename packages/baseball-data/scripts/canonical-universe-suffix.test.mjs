import { describe, expect, it } from 'vitest';
import { createCanonicalPlayerId } from './canonical-identity-core.mjs';
import { buildCanonicalPlayerUniverse } from './canonical-universe-core.mjs';

describe('canonical display-name suffixes', () => {
  it('uses a source-backed Jr. alias when the base source omits the suffix', () => {
    const result = buildCanonicalPlayerUniverse({
      lahmanPlayers: [{
        playerId: 'sample01',
        bbrefId: 'sample01',
        retroId: 'sample001',
        displayName: 'Sample Person',
        legalName: 'Sample Middle Person',
        debutYear: 1989,
        finalYear: 2010,
      }],
      canonicalIdentityPlayers: [{
        canonicalId: createCanonicalPlayerId('lahman:sample01'),
        status: 'approved',
        displayName: 'Sample Person',
        aliases: ['Sample Middle Person Jr.', 'Sample Person Jr.'],
        legacyPlayerIds: ['chadwick:sample'],
        lahmanPlayerId: 'sample01',
        sourceMappings: [{ source: 'lahman', externalId: 'sample01' }],
        weakLahmanCandidates: [],
      }],
      dispositionRecommendations: [],
      compatibilityRedirects: [],
      historicalReferenceIds: [],
    });

    expect(result.universePlayers[0]).toMatchObject({
      displayName: 'Sample Person Jr.',
      aliases: ['Sample Middle Person', 'Sample Middle Person Jr.'],
    });
  });
});
