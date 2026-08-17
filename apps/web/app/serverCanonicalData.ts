import 'server-only';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createFileSystemCanonicalRevealReader,
  createFileSystemCanonicalRuntimeAccessor,
  type CanonicalRevealReader,
  type CanonicalRuntimeAccessor,
} from '@initial-baseball/baseball-data/runtime';

let cachedCanonicalRuntime: CanonicalRuntimeAccessor | null = null;
let cachedCanonicalRevealReader: CanonicalRevealReader | null = null;
let cachedCanonicalSearchCandidates: ReturnType<typeof buildCanonicalSearchCandidates> | null = null;

export function getCanonicalRuntime(): CanonicalRuntimeAccessor {
  cachedCanonicalRuntime ??= createFileSystemCanonicalRuntimeAccessor(findRuntimeDirectory());
  return cachedCanonicalRuntime;
}

export function getCanonicalRevealReader(): CanonicalRevealReader {
  cachedCanonicalRevealReader ??= createFileSystemCanonicalRevealReader(findRuntimeDirectory());
  return cachedCanonicalRevealReader;
}

export function getCanonicalSearchCandidates() {
  cachedCanonicalSearchCandidates ??= buildCanonicalSearchCandidates();
  return cachedCanonicalSearchCandidates;
}

export function resolveCanonicalPlayerId(playerId: string): string | null {
  const resolution = getCanonicalRuntime().resolvePlayerId(playerId);
  return resolution.status === 'canonical' || resolution.status === 'redirected'
    ? resolution.playerId
    : null;
}

function buildCanonicalSearchCandidates() {
  return getCanonicalRuntime().getPlayerIndex().map(player => ({
    id: player.playerId,
    displayName: player.displayName,
    aliases: player.aliases,
    playerType: player.playerType,
    primaryPosition: player.primaryPosition,
    firstYear: player.firstSeason,
    lastYear: player.lastSeason,
    teamsDisplay: player.teamIds.join(', '),
  }));
}

function findRuntimeDirectory(): string {
  const candidates = [
    resolve(process.cwd(), 'packages/baseball-data/reports/canonical-runtime-payload'),
    resolve(process.cwd(), '../../packages/baseball-data/reports/canonical-runtime-payload'),
  ];
  const runtimeDirectory = candidates.find(candidate => existsSync(candidate));
  if (runtimeDirectory === undefined) {
    throw new Error('Canonical runtime artifacts are missing. Run pnpm data:runtime before building the web app.');
  }
  return runtimeDirectory;
}
