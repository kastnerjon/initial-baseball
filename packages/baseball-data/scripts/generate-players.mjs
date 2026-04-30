import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const PEOPLE_SHARDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
const PEOPLE_URL = 'https://raw.githubusercontent.com/chadwickbureau/register/master/data/people-';
const NAMES_URL = 'https://raw.githubusercontent.com/chadwickbureau/register/master/data/names.csv';
const OUTPUT_PATH = resolve(process.cwd(), 'src/generated/players.json');
const LAHMAN_DIR = resolve(process.cwd(), 'data/lahman');
const LAHMAN_PEOPLE_PATH = resolve(LAHMAN_DIR, 'People.csv');
const LAHMAN_APPEARANCES_PATH = resolve(LAHMAN_DIR, 'Appearances.csv');
const LAHMAN_BATTING_PATH = resolve(LAHMAN_DIR, 'Batting.csv');
const LAHMAN_PITCHING_PATH = resolve(LAHMAN_DIR, 'Pitching.csv');
const LAHMAN_TEAMS_PATH = resolve(LAHMAN_DIR, 'Teams.csv');
const POSITION_COLUMNS = [
  ['G_p', 'P'],
  ['G_c', 'C'],
  ['G_1b', '1B'],
  ['G_2b', '2B'],
  ['G_3b', '3B'],
  ['G_ss', 'SS'],
  ['G_lf', 'LF'],
  ['G_cf', 'CF'],
  ['G_rf', 'RF'],
  ['G_dh', 'DH'],
];

const peopleRows = [];
for (const shard of PEOPLE_SHARDS) {
  const csv = await fetchText(`${PEOPLE_URL}${shard}.csv`);
  peopleRows.push(...parseCsv(csv));
}

const nameRows = parseCsv(await fetchText(NAMES_URL));
const aliasesByPersonId = buildAliasesByPersonId(nameRows);
const lahmanPeopleRows = parseCsv(readFileSync(LAHMAN_PEOPLE_PATH, 'utf8'));
const lahmanAppearancesRows = parseCsv(readFileSync(LAHMAN_APPEARANCES_PATH, 'utf8'));
const lahmanBattingRows = parseCsv(readFileSync(LAHMAN_BATTING_PATH, 'utf8'));
const lahmanPitchingRows = parseCsv(readFileSync(LAHMAN_PITCHING_PATH, 'utf8'));
const lahmanTeamsRows = parseCsv(readFileSync(LAHMAN_TEAMS_PATH, 'utf8'));
const lahmanPlayersByReference = buildLahmanPlayersByReference(lahmanPeopleRows);
const lahmanEnrichmentByPlayerId = buildLahmanEnrichmentByPlayerId(
  lahmanAppearancesRows,
  lahmanBattingRows,
  lahmanPitchingRows,
  lahmanTeamsRows,
);

const players = peopleRows
  .filter(isEligiblePlayer)
  .map((row) => buildPlayer({
    row,
    aliases: aliasesByPersonId.get(row.key_person) ?? [],
    lahmanPlayer: resolveLahmanPlayer(row, lahmanPlayersByReference),
    lahmanEnrichmentByPlayerId,
  }))
  .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id));

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(players, null, 2)}\n`);

console.log(`Generated ${players.length} players at ${OUTPUT_PATH}`);

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseCsv(csv) {
  const rows = [];
  const [headerLine, ...lines] = csv.replace(/\r/g, '').trim().split('\n');
  const headers = parseCsvLine(headerLine);

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const values = parseCsvLine(line);
    const row = {};

    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = values[index] ?? '';
    }

    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function buildAliasesByPersonId(rows) {
  const aliasesByPersonId = new Map();

  for (const row of rows) {
    const personId = row.key_person;
    const alias = formatName({
      first: row.altname_given || row.altname_first,
      last: row.altname_matrilineal ? `${row.altname_matrilineal} ${row.altname_last}` : row.altname_last,
      suffix: '',
    });

    if (!personId || !alias) {
      continue;
    }

    const aliases = aliasesByPersonId.get(personId) ?? new Set();
    aliases.add(alias);

    if (row.altname_nick) {
      for (const nickname of splitNicknames(row.altname_nick)) {
        aliases.add(nickname);
      }
    }

    aliasesByPersonId.set(personId, aliases);
  }

  return new Map([...aliasesByPersonId.entries()].map(([personId, aliases]) => [personId, [...aliases].sort()]));
}

function buildLahmanPlayersByReference(rows) {
  const byBbrefId = new Map();
  const byRetroId = new Map();
  const byName = new Map();

  for (const row of rows) {
    const lahmanPlayer = {
      playerId: row.playerID,
      bbrefId: row.bbrefID?.trim() || '',
      retroId: row.retroID?.trim() || '',
      displayName: formatName({
        first: row.nameFirst,
        last: row.nameLast,
        suffix: '',
      }),
      legalName: formatName({
        first: row.nameGiven,
        last: row.nameLast,
        suffix: '',
      }),
      debutYear: parseYear(row.debut),
      finalYear: parseYear(row.finalGame),
    };

    if (lahmanPlayer.bbrefId) {
      byBbrefId.set(lahmanPlayer.bbrefId, lahmanPlayer);
    }

    if (lahmanPlayer.retroId) {
      byRetroId.set(lahmanPlayer.retroId, lahmanPlayer);
    }

    for (const name of [lahmanPlayer.displayName, lahmanPlayer.legalName]) {
      if (!name) {
        continue;
      }

      const key = normalizeName(name);
      const matches = byName.get(key) ?? [];
      matches.push(lahmanPlayer);
      byName.set(key, matches);
    }
  }

  return {
    byBbrefId,
    byRetroId,
    byName,
  };
}

function buildLahmanEnrichmentByPlayerId(appearanceRows, battingRows, pitchingRows, teamRows) {
  const teamAbbreviationByTeamId = buildTeamAbbreviationByTeamId(teamRows);
  const battingStatsByPlayerId = buildBattingStatsByPlayerId(battingRows);
  const pitchingStatsByPlayerId = buildPitchingStatsByPlayerId(pitchingRows);
  const enrichmentByPlayerId = new Map();

  for (const row of appearanceRows) {
    const playerId = row.playerID;
    const year = parseInteger(row.yearID);
    const appearanceGames = getAppearanceGames(row);

    if (!playerId || year === 0) {
      continue;
    }

    const current = enrichmentByPlayerId.get(playerId) ?? {
      decadeGames: new Map(),
      positionGames: new Map(),
      teamFirstYear: new Map(),
      teamGames: new Map(),
      teamHistory: [],
    };

    for (const [column, position] of POSITION_COLUMNS) {
      const games = parseInteger(row[column]);

      if (games > 0) {
        current.positionGames.set(position, (current.positionGames.get(position) ?? 0) + games);
      }
    }

    const abbreviation = teamAbbreviationByTeamId.get(row.teamID) ?? row.teamID;

    if (appearanceGames > 0) {
      const decade = Math.floor(year / 10) * 10;
      current.decadeGames.set(decade, (current.decadeGames.get(decade) ?? 0) + appearanceGames);

      if (abbreviation) {
        current.teamGames.set(abbreviation, (current.teamGames.get(abbreviation) ?? 0) + appearanceGames);
        current.teamFirstYear.set(
          abbreviation,
          Math.min(current.teamFirstYear.get(abbreviation) ?? Number.POSITIVE_INFINITY, year),
        );
      }
    }

    if (abbreviation) {
      current.teamHistory.push({
        year,
        abbreviation,
      });
    }

    enrichmentByPlayerId.set(playerId, current);
  }

  return new Map([...enrichmentByPlayerId.entries()].map(([playerId, enrichment]) => {
    const primaryPosition = derivePrimaryPosition(enrichment.positionGames);
    const mainDecade = deriveMainDecade(enrichment.decadeGames);
    const primaryTeam = derivePrimaryTeam(enrichment.teamGames, enrichment.teamFirstYear, enrichment.teamHistory);
    const teamsDisplay = deriveTeamsDisplay(enrichment.teamHistory);
    const primaryRole = primaryPosition === 'P' ? 'pitcher' : 'hitter';
    const statsLine = primaryRole === 'pitcher'
      ? formatPitcherStatsLine(pitchingStatsByPlayerId.get(playerId))
      : formatHitterStatsLine(battingStatsByPlayerId.get(playerId));

    return [playerId, {
      mainDecade,
      primaryTeam,
      primaryRole,
      primaryPosition,
      teamsDisplay,
      statsLine,
    }];
  }));
}

function buildBattingStatsByPlayerId(rows) {
  const battingStatsByPlayerId = new Map();

  for (const row of rows) {
    if (!row.playerID) {
      continue;
    }

    const current = battingStatsByPlayerId.get(row.playerID) ?? {
      hr: 0,
      rbi: 0,
      sb: 0,
      hits: 0,
      atBats: 0,
      walks: 0,
      hitByPitch: 0,
      sacrificeFlies: 0,
    };

    current.hr += parseInteger(row.HR);
    current.rbi += parseInteger(row.RBI);
    current.sb += parseInteger(row.SB);
    current.hits += parseInteger(row.H);
    current.atBats += parseInteger(row.AB);
    current.walks += parseInteger(row.BB);
    current.hitByPitch += parseInteger(row.HBP);
    current.sacrificeFlies += parseInteger(row.SF);

    battingStatsByPlayerId.set(row.playerID, current);
  }

  return battingStatsByPlayerId;
}

function buildPitchingStatsByPlayerId(rows) {
  const pitchingStatsByPlayerId = new Map();

  for (const row of rows) {
    if (!row.playerID) {
      continue;
    }

    const current = pitchingStatsByPlayerId.get(row.playerID) ?? {
      wins: 0,
      losses: 0,
      strikeouts: 0,
      earnedRuns: 0,
      walks: 0,
      hits: 0,
      ipOuts: 0,
    };

    current.wins += parseInteger(row.W);
    current.losses += parseInteger(row.L);
    current.strikeouts += parseInteger(row.SO);
    current.earnedRuns += parseInteger(row.ER);
    current.walks += parseInteger(row.BB);
    current.hits += parseInteger(row.H);
    current.ipOuts += parseInteger(row.IPouts);

    pitchingStatsByPlayerId.set(row.playerID, current);
  }

  return pitchingStatsByPlayerId;
}

function buildTeamAbbreviationByTeamId(rows) {
  const abbreviations = new Map();

  for (const row of rows) {
    const abbreviation = row.teamIDBR?.trim() || row.teamIDretro?.trim() || row.teamID?.trim();

    if (!row.teamID || !abbreviation) {
      continue;
    }

    abbreviations.set(row.teamID, abbreviation);
  }

  return abbreviations;
}

function isEligiblePlayer(row) {
  const mlbFirst = parseYear(row.mlb_played_first);
  const mlbLast = parseYear(row.mlb_played_last);
  const hasMlbYears = mlbFirst !== null || mlbLast !== null;

  if (!hasMlbYears) {
    return false;
  }

  return (mlbFirst ?? mlbLast ?? 0) >= 1950 || (mlbLast ?? mlbFirst ?? 0) >= 1950;
}

function resolveLahmanPlayer(row, lahmanPlayersByReference) {
  const bbrefId = row.key_bbref?.trim();
  const retroId = row.key_retro?.trim();
  const mainYear = parseYear(row.mlb_played_first)
    ?? parseYear(row.mlb_played_last)
    ?? parseYear(row.pro_played_first)
    ?? parseYear(row.pro_played_last)
    ?? 0;

  if (bbrefId && lahmanPlayersByReference.byBbrefId.has(bbrefId)) {
    return lahmanPlayersByReference.byBbrefId.get(bbrefId);
  }

  if (retroId && lahmanPlayersByReference.byRetroId.has(retroId)) {
    return lahmanPlayersByReference.byRetroId.get(retroId);
  }

  const displayName = formatName({
    first: row.name_first || row.name_given,
    last: row.name_matrilineal ? `${row.name_matrilineal} ${row.name_last}` : row.name_last,
    suffix: row.name_suffix,
  });
  const legalName = formatName({
    first: row.name_given,
    last: row.name_last,
    suffix: row.name_suffix,
  });
  const candidates = [
    ...(lahmanPlayersByReference.byName.get(normalizeName(displayName)) ?? []),
    ...(lahmanPlayersByReference.byName.get(normalizeName(legalName)) ?? []),
  ];

  if (candidates.length === 0) {
    return null;
  }

  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.playerId, candidate])).values()];

  uniqueCandidates.sort((left, right) => {
    const leftDistance = yearDistance(left, mainYear);
    const rightDistance = yearDistance(right, mainYear);

    return leftDistance - rightDistance
      || left.displayName.localeCompare(right.displayName)
      || left.playerId.localeCompare(right.playerId);
  });

  return uniqueCandidates[0] ?? null;
}

function buildPlayer({ row, aliases, lahmanPlayer, lahmanEnrichmentByPlayerId }) {
  const commonName = formatName({
    first: row.name_first || row.name_given,
    last: row.name_matrilineal ? `${row.name_matrilineal} ${row.name_last}` : row.name_last,
    suffix: row.name_suffix,
  });
  const legalName = formatName({
    first: row.name_given,
    last: row.name_last,
    suffix: row.name_suffix,
  });
  const fullName = commonName || legalName;
  const displayName = commonName || legalName;
  const mainYear = parseYear(row.mlb_played_first)
    ?? parseYear(row.mlb_played_last)
    ?? parseYear(row.pro_played_first)
    ?? parseYear(row.pro_played_last);
  const enrichment = lahmanPlayer === null ? null : lahmanEnrichmentByPlayerId.get(lahmanPlayer.playerId) ?? null;

  return {
    id: `chadwick:${row.key_person}`,
    fullName,
    displayName,
    primaryRole: enrichment?.primaryRole ?? 'hitter',
    primaryPosition: enrichment?.primaryPosition ?? 'Unknown',
    mainDecade: enrichment?.mainDecade ?? (mainYear === null ? 'Unknown' : `${Math.floor(mainYear / 10) * 10}s`),
    primaryTeam: enrichment?.primaryTeam ?? '',
    teamsDisplay: enrichment?.teamsDisplay ?? '',
    statsLine: enrichment?.statsLine ?? formatHitterStatsLine(undefined),
    aliases: [...new Set([...(legalName && legalName !== fullName ? [legalName] : []), ...(row.name_nick ? splitNicknames(row.name_nick) : []), ...aliases])]
      .filter((alias) => alias && alias !== fullName && alias !== displayName)
      .sort(),
  };
}

function derivePrimaryPosition(positionGames) {
  const rankedPositions = [...positionGames.entries()]
    .filter(([, games]) => games > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  return rankedPositions[0]?.[0] ?? 'Unknown';
}

function deriveTeamsDisplay(teamHistory) {
  const uniqueTeams = [];
  const seen = new Set();

  teamHistory
    .filter((team) => team.abbreviation)
    .sort((left, right) => left.year - right.year || left.abbreviation.localeCompare(right.abbreviation))
    .forEach((team) => {
      if (seen.has(team.abbreviation)) {
        return;
      }

      seen.add(team.abbreviation);
      uniqueTeams.push(team.abbreviation);
    });

  return uniqueTeams.slice(0, 5).join(', ');
}

function deriveMainDecade(decadeGames) {
  const rankedDecades = [...decadeGames.entries()]
    .filter(([, games]) => games > 0)
    .sort((left, right) => right[1] - left[1] || left[0] - right[0]);

  return rankedDecades[0] === undefined ? null : `${rankedDecades[0][0]}s`;
}

function derivePrimaryTeam(teamGames, teamFirstYear, teamHistory) {
  const rankedTeams = [...teamGames.entries()]
    .filter(([, games]) => games > 0)
    .sort((left, right) => (
      right[1] - left[1]
      || (teamFirstYear.get(left[0]) ?? Number.POSITIVE_INFINITY) - (teamFirstYear.get(right[0]) ?? Number.POSITIVE_INFINITY)
      || left[0].localeCompare(right[0])
    ));

  if (rankedTeams[0] !== undefined) {
    return rankedTeams[0][0];
  }

  return deriveTeamsDisplay(teamHistory).split(', ')[0] ?? '';
}

function formatHitterStatsLine(stats) {
  const battingAverage = stats === undefined || stats.atBats === 0
    ? 'BA —'
    : `BA ${formatAverage(stats.hits / stats.atBats)}`;
  const onBasePercentageDenominator = (stats?.atBats ?? 0) + (stats?.walks ?? 0) + (stats?.hitByPitch ?? 0) + (stats?.sacrificeFlies ?? 0);
  const onBasePercentage = stats === undefined || onBasePercentageDenominator === 0
    ? 'OBP —'
    : `OBP ${formatAverage(((stats.hits ?? 0) + (stats.walks ?? 0) + (stats.hitByPitch ?? 0)) / onBasePercentageDenominator)}`;

  return [
    `HR ${stats?.hr ?? 0}`,
    `RBI ${stats?.rbi ?? 0}`,
    battingAverage,
    onBasePercentage,
    `SB ${stats?.sb ?? 0}`,
  ].join(' / ');
}

function formatPitcherStatsLine(stats) {
  const inningsPitched = (stats?.ipOuts ?? 0) / 3;
  const era = stats === undefined || inningsPitched === 0
    ? 'ERA —'
    : `ERA ${formatFixedTwo((9 * (stats.earnedRuns ?? 0)) / inningsPitched)}`;
  const whip = stats === undefined || inningsPitched === 0
    ? 'WHIP —'
    : `WHIP ${formatFixedTwo(((stats.walks ?? 0) + (stats.hits ?? 0)) / inningsPitched)}`;

  return [
    `W ${stats?.wins ?? 0}`,
    `L ${stats?.losses ?? 0}`,
    era,
    whip,
    `K ${stats?.strikeouts ?? 0}`,
  ].join(' / ');
}

function formatName({ first, last, suffix }) {
  return [first?.trim(), last?.trim(), suffix?.trim()].filter(Boolean).join(' ');
}

function normalizeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatAverage(value) {
  const rounded = value.toFixed(3);
  return rounded.startsWith('0') ? rounded.slice(1) : rounded;
}

function formatFixedTwo(value) {
  return value.toFixed(2);
}

function parseYear(value) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed.slice(0, 4), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function splitNicknames(value) {
  return value
    .split(/[;/]/)
    .map((nickname) => nickname.trim())
    .filter(Boolean);
}

function yearDistance(lahmanPlayer, year) {
  const debutDistance = lahmanPlayer.debutYear === null ? Number.POSITIVE_INFINITY : Math.abs(lahmanPlayer.debutYear - year);
  const finalDistance = lahmanPlayer.finalYear === null ? Number.POSITIVE_INFINITY : Math.abs(lahmanPlayer.finalYear - year);

  return Math.min(debutDistance, finalDistance);
}

function parseInteger(value) {
  const parsed = Number.parseInt(value?.trim() || '0', 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getAppearanceGames(row) {
  const overallGames = parseInteger(row.G_all);

  if (overallGames > 0) {
    return overallGames;
  }

  return POSITION_COLUMNS.reduce((total, [column]) => total + parseInteger(row[column]), 0);
}
