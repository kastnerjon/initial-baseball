import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collapseChronologicalTeamStints, parseCsv } from './team-display-identities.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(resolve(packageRoot, path), 'utf8'));
const readRows = (path) => parseCsv(readFileSync(resolve(packageRoot, path), 'utf8'));
const players = readJson('src/generated/players.json');
const snapshotDir = resolve(packageRoot, 'data/canonical/identity-snapshot');
const lahmanByLegacyId = new Map();

for (const filename of readdirSync(snapshotDir).filter((file) => /^players-[0-9a-f]\.json$/.test(file))) {
  const snapshot = JSON.parse(readFileSync(join(snapshotDir, filename), 'utf8'));
  for (const player of snapshot.players ?? []) {
    if (!player.lahmanPlayerId) continue;
    for (const legacyId of player.legacyPlayerIds ?? []) {
      lahmanByLegacyId.set(legacyId, player.lahmanPlayerId);
    }
  }
}

const teamAbbreviation = new Map();
for (const row of readRows('data/lahman/Teams.csv')) {
  if (row.teamID) {
    teamAbbreviation.set(row.teamID, row.teamIDBR?.trim() || row.teamIDretro?.trim() || row.teamID);
  }
}

const historyByLahmanId = new Map();
for (const row of readRows('data/lahman/Appearances.csv')) {
  const year = Number.parseInt(row.yearID, 10);
  if (!row.playerID || !row.teamID || !Number.isInteger(year)) continue;
  const history = historyByLahmanId.get(row.playerID) ?? [];
  history.push({ year, abbreviation: teamAbbreviation.get(row.teamID) ?? row.teamID });
  historyByLahmanId.set(row.playerID, history);
}

const lahmanByName = new Map();
for (const row of readRows('data/lahman/People.csv')) {
  if (!row.playerID) continue;
  for (const name of [joinName(row.nameFirst, row.nameLast), joinName(row.nameGiven, row.nameLast)]) {
    const normalized = normalizeName(name);
    if (!normalized) continue;
    const ids = lahmanByName.get(normalized) ?? [];
    if (!ids.includes(row.playerID)) ids.push(row.playerID);
    lahmanByName.set(normalized, ids);
  }
}

function joinName(first, last) {
  return [first, last].filter(Boolean).join(' ');
}

function normalizeName(name) {
  return String(name ?? '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function fallbackLahmanId(player) {
  const candidates = [...new Set(
    [player.displayName, player.fullName]
      .flatMap((name) => lahmanByName.get(normalizeName(name)) ?? []),
  )];
  const firstYear = player.firstYear ?? 0;
  candidates.sort((left, right) => {
    const earliest = (id) => {
      const years = (historyByLahmanId.get(id) ?? []).map((entry) => entry.year);
      return years.length === 0 ? 0 : Math.min(...years);
    };
    return Math.abs(earliest(left) - firstYear) - Math.abs(earliest(right) - firstYear)
      || left.localeCompare(right);
  });
  return candidates[0] ?? null;
}

const overrides = {};
for (const player of players) {
  if (!player.teamsDisplay) continue;
  const lahmanId = lahmanByLegacyId.get(player.id) ?? fallbackLahmanId(player);
  if (!lahmanId) continue;
  const ordered = collapseChronologicalTeamStints(historyByLahmanId.get(lahmanId) ?? [])
    .map((entry) => entry.abbreviation)
    .join(', ');
  if (ordered && ordered !== player.teamsDisplay) {
    overrides[player.id] = ordered;
  }
}

// This older player has a sourced history but is not resolvable by the
// committed canonical snapshot or Lahman People name-only lookup.
if (players.some((player) => player.id === 'chadwick:ffe07567')) {
  overrides['chadwick:ffe07567'] = 'CSH, SC1, CSH, CAG, DS, KCM';
}

const output = resolve(packageRoot, 'src/generated/team-history-overrides.json');
writeFileSync(output, JSON.stringify(overrides, null, 2) + '\n');
console.log(`Generated ${Object.keys(overrides).length} chronological team-history overrides.`);
