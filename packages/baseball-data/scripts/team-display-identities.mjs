const TEAM_DISPLAY_NAME_CORRECTIONS = new Map([
  ['2016:LAA', 'Los Angeles Angels'],
  ['2017:LAA', 'Los Angeles Angels'],
  ['2018:LAA', 'Los Angeles Angels'],
  ['2019:LAA', 'Los Angeles Angels'],
  ['2020:LAA', 'Los Angeles Angels'],
  ['2021:LAA', 'Los Angeles Angels'],
  ['2022:LAA', 'Los Angeles Angels'],
  ['2023:LAA', 'Los Angeles Angels'],
  ['2024:LAA', 'Los Angeles Angels'],
  ['2025:LAA', 'Los Angeles Angels'],
]);

export function buildTeamDisplayIdentityIndex(csvText) {
  const rows = parseCsv(csvText);
  const index = new Map();

  for (const row of rows) {
    const season = integer(row.yearID);
    const sourceTeamId = clean(row.teamID);
    if (!season || !sourceTeamId) continue;

    const key = teamIdentityKey(season, sourceTeamId);
    const identity = {
      sourceTeamId,
      abbreviation: clean(row.teamIDBR) || clean(row.teamIDretro) || sourceTeamId,
      displayName: TEAM_DISPLAY_NAME_CORRECTIONS.get(key) || clean(row.name) || sourceTeamId,
    };

    const existing = index.get(key);
    if (existing && !sameIdentity(existing, identity)) {
      throw new Error(`Conflicting team display identity for ${key}`);
    }
    index.set(key, identity);
  }

  return index;
}

export function resolveTeamDisplayIdentities({ season, teamIds, index }) {
  return [...new Set(teamIds ?? [])]
    .sort()
    .map((sourceTeamId) => {
      const identity = index.get(teamIdentityKey(season, sourceTeamId));
      if (!identity) {
        throw new Error(`Missing t¶»§q«^