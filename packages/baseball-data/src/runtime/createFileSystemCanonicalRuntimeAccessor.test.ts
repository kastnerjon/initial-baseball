import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFileSystemCanonicalRevealReader } from './createFileSystemCanonicalRuntimeAccessor.js';
import type { CanonicalPlayerReveal } from './types.js';

const playerId = 'ibp_ab000000000000000000';
const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('file-system canonical reveal reader', () => {
  it('loads a canonical reveal without requiring the player index or redirects', () => {
    const runtimeDirectory = createRuntimeDirectory();
    const reveal = buildReveal();
    mkdirSync(join(runtimeDirectory, 'reveal-shards'));
    writeFileSync(join(runtimeDirectory, 'reveal-shards', 'ab.json'), JSON.stringify({
      schemaVersion: 1,
      shardId: 'ab',
      players: { [playerId]: reveal },
    }));

    const reader = createFileSystemCanonicalRevealReader(runtimeDirectory);

    expect(reader.getReveal(playerId)).toEqual(reveal);
  });
});

function createRuntimeDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'initial-baseball-reveal-'));
  tempDirectories.push(directory);
  return directory;
}

function buildReveal(): CanonicalPlayerReveal {
  return {
    schemaVersion: 1,
    playerId,
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
