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
        throw new Error(`Missing team display identity for ${season}:${sourceTeamId}`);
      }
      return { ...identity };
    });
}

export function collapseCareerTeamDisplayIdentities(seasons) {
  const identities = new Map();

  for (const season of seasons) {
    for (const identity of season.teamIdentities ?? []) {
      const key = `${identity.abbreviation}|${identity.displayName}`;
      if (!identities.has(key)) identities.set(key, { ...identity });
    }
  }

  return [...identities.values()].sort(
    (left, right) => left.abbreviation.localeCompare(right.abbreviation)
      || left.displayName.localeCompare(right.displayName),
  );
}

export function auditTeamDisplayIdentityCoverage({ seasons, index }) {
  const missing = [];
  const sourceIds = new Set();
  const abbreviations = new Set();

  for (const season of seasons) {
    for (const sourceTeamId of season.teamIds ?? []) {
      sourceIds.add(sourceTeamId);
      const identity = index.get(teamIdentityKey(season.season, sourceTeamId));
      if (!identity) missing.push(`${season.season}:${sourceTeamId}`);
      else abbreviations.add(identity.abbreviation);
    }
  }

  return {
    sourceTeamIdCount: sourceIds.size,
    displayAbbreviationCount: abbreviations.size,
    missing: [...new Set(missing)].sort(),
  };
}

function teamIdentityKey(season, sourceTeamId) {
  return `${season}:${sourceTeamId}`;
}

function sameIdentity(left, right) {
  return left.sourceTeamId === right.sourceTeamId
    && left.abbreviation === right.abbreviation
    && left.displayName === right.displayName;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const [headers = [], ...records] = rows;
  return records
    .filter((record) => record.some((value) => value !== ''))
    .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])));
}

function clean(value) {
  return String(value ?? '').trim();
}

function integer(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}
