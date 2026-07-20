import 'server-only';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFileSystemCanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import { createCanonicalDailyPuzzleForDate } from './createDailyPuzzleForDate';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createDailyRuntimeService } from './dailyRuntimeService';

export const canonicalRuntime = createFileSystemCanonicalRuntimeAccessor(findRuntimeDirectory());
export const canonicalSearchCandidates = canonicalRuntime.getPlayerIndex().map(player => ({
  id: player.playerId,
  displayName: player.displayName,
  aliases: player.aliases,
  playerType: player.playerType,
  primaryPosition: player.primaryPosition,
  firstYear: player.firstSeason,
  lastYear: player.lastSeason,
  teamsDisplay: player.teamIds.join(', '),
}));
export const dailyRuntime = createDailyRuntimeService({
  canonicalRuntime,
  createPuzzle: date => createCanonicalDailyPuzzleForDate(date, resolveCanonicalPlayerId),
  progressionTokens: createDailyProgressionTokenCodec(getDailyProgressionSecret()),
});

function resolveCanonicalPlayerId(playerId: string): string | null {
  const resolution = canonicalRuntime.resolvePlayerId(playerId);
  return resolution.status === 'canonical' || resolution.status === 'redirected'
    ? resolution.playerId
    : null;
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
