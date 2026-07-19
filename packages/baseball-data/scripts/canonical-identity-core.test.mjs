import { describe, expect, it } from 'vitest';
import {
  buildCanonicalIdentityLayer,
  createCanonicalPlayerId,
} from './canonical-identity-core.mjs';

function legacyPlayer(overrides = {}) {
  return {
    id: 'chadwick:one',
    fullName: 'Example Player',
    displayName: 'Example Player',
    firstYear: 2000,
    lastYear: 2010,
    dailyEligibilityTier: 'core',
    aliases: [],
    ...overrides,
  };
}

function chadwickRow(overrides = {}) {
  return {
    key_person: 'one',
    key_uuid: 'uuid-one',
    key_bbref: '',
    key_retro: '',
    key_mlbam: '',
    name_first: 'Example',
    name_given: 'Example Middle',
    name_last: 'Player',
    name_matrilineal: '',
    name_suffix: '',
    ...overrides,
  };
}

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

describe('canonical identity resolution', () => {
  it('merges multiple legacy rows that share one strong Lahman identity', () => {
    const result = buildCanonicalIdentityLayer({
      legacyPlayers: [
        legacyPlayer(),
        legacyPlayer({
          id: 'chadwick:two',
          fullName: 'Example Middle Player',
          displayName: 'Example M. Player',
        }),
      ],
      chadwickRows: [
        chadwickRow(),
        chadwickRow({
          key_person: 'two',
          key_uuid: 'uuid-two',
          key_bbref: 'playerex01',
          key_retro: 'playe001',
        }),
      ],
      lahmanPlayers: [lahmanPlayer()],
    });

    expect(result.canonicalPlayers).toHaveLength(1);
    expect(result.canonicalPlayers[0]).toMatchObject({
      canonicalId: createCanonicalPlayerId('lahman:player01'),
      displayName: 'Example Player',
      lahmanPlayerId: 'player01',
      status: 'approved',
      legacyPlayerIds: ['chadwick:one', 'chadwick:two'],
    });
    expect(result.redirects).toEqual({
      'chadwick:one': createCanonicalPlayerId('lahman:player01'),
      'chadwick:two': createCanonicalPlayerId('lahman:player01'),
    });
    expect(result.report.summary.mergedLegacyGroupCount).toBe(1);
    expect(result.report.validation.criticalIssues).toEqual([]);
  });

  it('keeps genuinely different same-name people separate', () => {
    const result = buildCanonicalIdentityLayer({
      legacyPlayers: [
        legacyPlayer({ id: 'chadwick:old', firstYear: 1920, lastYear: 1922 }),
        legacyPlayer({ id: 'chadwick:new', firstYear: 2006, lastYear: 2006 }),
      ],
      chadwickRows: [
        chadwickRow({
          key_person: 'old',
          key_uuid: 'uuid-old',
          key_bbref: 'sameold01',
          key_retro: 'sameo001',
        }),
        chadwickRow({
          key_person: 'new',
          key_uuid: 'uuid-new',
          key_bbref: 'samenew01',
          key_retro: 'samen001',
        }),
      ],
      lahmanPlayers: [
        lahmanPlayer({
          playerId: 'sameold01',
          bbrefId: 'sameold01',
          retroId: 'sameo001',
          displayName: 'Ben Taylor',
          legalName: 'Benjamin Taylor',
          debutYear: 1920,
          finalYear: 1922,
        }),
        lahmanPlayer({
          playerId: 'samenew01',
          bbrefId: 'samenew01',
          retroId: 'samen001',
          displayName: 'Ben Taylor',
          legalName: 'Benjamin Taylor',
          debutYear: 2006,
          finalYear: 2006,
        }),
      ],
    });

    expect(result.canonicalPlayers).toHaveLength(2);
    expect(new Set(result.canonicalPlayers.map((player) => player.canonicalId)).size).toBe(2);
    expect(result.report.duplicateCanonicalDisplayNames).toHaveLength(1);
    expect(result.report.validation.criticalIssues).toEqual([]);
  });

  it('does not auto-merge a name-only match', () => {
    const result = buildCanonicalIdentityLayer({
      legacyPlayers: [legacyPlayer()],
      chadwickRows: [chadwickRow({ key_bbref: '', key_retro: '' })],
      lahmanPlayers: [lahmanPlayer()],
    });

    expect(result.canonicalPlayers).toHaveLength(1);
    expect(result.canonicalPlayers[0]).toMatchObject({
      status: 'review',
      lahmanPlayerId: null,
      weakLahmanCandidates: [
        expect.objectContaining({ lahmanPlayerId: 'player01' }),
      ],
    });
    expect(result.canonicalPlayers[0].canonicalId).toBe(createCanonicalPlayerId('legacy:chadwick:one'));
  });

  it('quarantines conflicting strong identifiers instead of merging two Lahman players', () => {
    const result = buildCanonicalIdentityLayer({
      legacyPlayers: [legacyPlayer()],
      chadwickRows: [
        chadwickRow({
          key_bbref: 'firstbb01',
          key_retro: 'secon001',
        }),
      ],
      lahmanPlayers: [
        lahmanPlayer({
          playerId: 'first01',
          bbrefId: 'firstbb01',
          retroId: 'first001',
        }),
        lahmanPlayer({
          playerId: 'second01',
          bbrefId: 'secondbb01',
          retroId: 'secon001',
        }),
      ],
    });

    expect(result.canonicalPlayers).toHaveLength(1);
    expect(result.canonicalPlayers[0]).toMatchObject({
      status: 'review',
      lahmanPlayerId: null,
      legacyPlayerIds: ['chadwick:one'],
    });
    expect(result.report.validation.criticalIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'multiple_lahman_players_in_component' }),
    ]));
  });

  it('produces identical output regardless of input order', () => {
    const input = {
      legacyPlayers: [
        legacyPlayer(),
        legacyPlayer({ id: 'chadwick:two', displayName: 'Another Name' }),
      ],
      chadwickRows: [
        chadwickRow(),
        chadwickRow({
          key_person: 'two',
          key_uuid: 'uuid-two',
          key_bbref: 'playerex01',
        }),
      ],
      lahmanPlayers: [lahmanPlayer()],
    };

    const forward = buildCanonicalIdentityLayer(input);
    const reversed = buildCanonicalIdentityLayer({
      ...input,
      legacyPlayers: [...input.legacyPlayers].reverse(),
      chadwickRows: [...input.chadwickRows].reverse(),
      lahmanPlayers: [...input.lahmanPlayers].reverse(),
    });

    expect(reversed).toEqual(forward);
  });
});
