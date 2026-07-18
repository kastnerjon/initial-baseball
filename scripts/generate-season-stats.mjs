import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = resolve(ROOT, 'packages/baseball-data/data/lahman');
const PLAYERS_PATH = resolve(ROOT, 'packages/baseball-data/src/generated/players.json');
const SAVES_OUTPUT_PATH = resolve(ROOT, 'packages/baseball-data/src/generated/pitcher-saves.json');
const SEASONS_OUTPUT_PATH = resolve(ROOT, 'apps/web/app/api/player-seasons/season-stats.json');
const EMPTY = '—';

const players = JSON.parse(readFileSync(PLAYERS_PATH, 'utf8'));
const peopleRows = parseCsv(readFileSync(resolve(DATA_DIR, 'People.csv'), 'utf8'));
const battingRows = parseCsv(readFileSync(resolve(DATA_DIR, 'Batting.csv'), 'utf8'));
const pitchingRows = parseCsv(readFileSync(resolve(DATA_DIR, 'Pitching.csv'), 'utf8'));
const teamRows = parseCsv(readFileSync(resolve(DATA_DIR, 'Teams.csv'), 'utf8'));

const playerByLahmanId = matchPlayersToLahman(players, peopleRows);
const teamAbbreviations = buildTeamAbbreviations(teamRows);
const battingByPlayerYear = aggregateBatting(battingRows, teamAbbreviations);
const pitchingByPlayerYear = aggregatePitching(pitchingRows, teamAbbreviations);
const seasonStats = {};
const pitcherSaves = {};

for (const [lahmanId, player] of playerByLahmanId) {
  if (player.primaryRole === 'pitcher') {
    const seasons = [...(pitchingByPlayerYear.get(lahmanId)?.values() ?? [])]
      .sort((left, right) => right.year - left.year)
      .map(formatPitcherSeason);
    seasonStats[player.id] = seasons;
    pitcherSaves[player.id] = seasons.reduce((total, season) => total + season.stats.SV, 0);
  } else {
    seasonStats[player.id] = [...(battingByPlayerYear.get(lahmanId)?.values() ?? [])]
      .sort((left, right) => right.year - left.year)
      .map(formatHitterSeason);
  }
}

writeJson(SAVES_OUTPUT_PATH, pitcherSaves);
writeJson(SEASONS_OUTPUT_PATH, seasonStats);
console.log(`Generated season stats for ${Object.keys(seasonStats).length} players.`);

function matchPlayersToLahman(generatedPlayers, rows) {
  const lahmanCandidatesByName = new Map();

  for (const row of rows) {
    if (!row.playerID) continue;
    const candidate = {
      playerID: row.playerID,
      firstYear: parseYear(row.debut),
      lastYear: parseYear(row.finalGame),
    };
    const names = [
      formatName(row.nameFirst, row.nameLast),
      formatName(row.nameGiven, row.nameLast),
    ];

    for (const name of names) {
      const key = normalizeName(name);
      if (!key) continue;
      const candidates = lahmanCandidatesByName.get(key) ?? [];
      if (!candidates.some((item) => item.playerID === candidate.playerID)) candidates.push(candidate);
      lahmanCandidatesByName.set(key, candidates);
    }
  }

  const matches = new Map();
  const usedLahmanIds = new Set();

  for (const player of generatedPlayers) {
    const names = [player.fullName, player.displayName, ...(player.aliases ?? [])];
    const candidates = names.flatMap((name) => lahmanCandidatesByName.get(normalizeName(name)) ?? []);
    const unique = [...new Map(candidates.map((candidate) => [candidate.playerID, candidate])).values()]
      .filter((candidate) => !usedLahmanIds.has(candidate.playerID))
      .sort((left, right) => careerDistance(left, player) - careerDistance(right, player));
    const match = unique[0];
    if (match === undefined) continue;
    matches.set(match.playerID, player);
    usedLahmanIds.add(match.playerID);
  }

  return matches;
}

function aggregateBatting(rows, teamAbbreviations) {
  const byPlayer = new Map();
  for (const row of rows) {
    const year = parseInteger(row.yearID);
    if (!row.playerID || year === 0) continue;
    const byYear = byPlayer.get(row.playerID) ?? new Map();
    const current = byYear.get(year) ?? {
      year,
      teams: new Set(),
      atBats: 0,
      hits: 0,
      homeRuns: 0,
      runs: 0,
      runsBattedIn: 0,
      stolenBases: 0,
      walks: 0,
      hitByPitch: 0,
      sacrificeFlies: 0,
      doubles: 0,
      triples: 0,
    };
    addTeam(current.teams, teamAbbreviations, row);
    current.atBats += parseInteger(row.AB);
    current.hits += parseInteger(row.H);
    current.homeRuns += parseInteger(row.HR);
    current.runs += parseInteger(row.R);
    current.runsBattedIn += parseInteger(row.RBI);
    current.stolenBases += parseInteger(row.SB);
    current.walks += parseInteger(row.BB);
    current.hitByPitch += parseInteger(row.HBP);
    current.sacrificeFlies += parseInteger(row.SF);
    current.doubles += parseInteger(row['2B']);
    current.triples += parseInteger(row['3B']);
    byYear.set(year, current);
    byPlayer.set(row.playerID, byYear);
  }
  return byPlayer;
}

function aggregatePitching(rows, teamAbbreviations) {
  const byPlayer = new Map();
  for (const row of rows) {
    const year = parseInteger(row.yearID);
    if (!row.playerID || year === 0) continue;
    const byYear = byPlayer.get(row.playerID) ?? new Map();
    const current = byYear.get(year) ?? {
      year,
      teams: new Set(),
      wins: 0,
      losses: 0,
      saves: 0,
      earnedRuns: 0,
      walks: 0,
      hits: 0,
      strikeouts: 0,
      ipOuts: 0,
    };
    addTeam(current.teams, teamAbbreviations, row);
    current.wins += parseInteger(row.W);
    current.losses += parseInteger(row.L);
    current.saves += parseInteger(row.SV);
    current.earnedRuns += parseInteger(row.ER);
    current.walks += parseInteger(row.BB);
    current.hits += parseInteger(row.H);
    current.strikeouts += parseInteger(row.SO);
    current.ipOuts += parseInteger(row.IPouts);
    byYear.set(year, current);
    byPlayer.set(row.playerID, byYear);
  }
  return byPlayer;
}

function formatHitterSeason(season) {
  const obpDenominator = season.atBats + season.walks + season.hitByPitch + season.sacrificeFlies;
  const totalBases = season.hits + season.doubles + (2 * season.triples) + (3 * season.homeRuns);
  const obp = obpDenominator === 0 ? EMPTY : formatAverage((season.hits + season.walks + season.hitByPitch) / obpDenominator);
  const slg = season.atBats === 0 ? EMPTY : formatAverage(totalBases / season.atBats);
  return {
    year: season.year,
    teams: formatTeams(season.teams),
    kind: 'hitter',
    stats: {
      AB: season.atBats,
      H: season.hits,
      HR: season.homeRuns,
      BA: season.atBats === 0 ? EMPTY : formatAverage(season.hits / season.atBats),
      R: season.runs,
      RBI: season.runsBattedIn,
      SB: season.stolenBases,
      OBP: obp,
      SLG: slg,
      OPS: obp === EMPTY || slg === EMPTY ? EMPTY : formatAverage(Number(obp) + Number(slg)),
    },
  };
}

function formatPitcherSeason(season) {
  const innings = season.ipOuts / 3;
  return {
    year: season.year,
    teams: formatTeams(season.teams),
    kind: 'pitcher',
    stats: {
      W: season.wins,
      L: season.losses,
      SV: season.saves,
      ERA: innings === 0 ? EMPTY : ((9 * season.earnedRuns) / innings).toFixed(2),
      WHIP: innings === 0 ? EMPTY : ((season.walks + season.hits) / innings).toFixed(2),
      K: season.strikeouts,
      IP: formatInnings(season.ipOuts),
    },
  };
}

function buildTeamAbbreviations(rows) {
  const abbreviations = new Map();
  for (const row of rows) {
    const year = parseInteger(row.yearID);
    const abbreviation = row.teamIDBR?.trim() || row.teamIDretro?.trim() || row.teamID?.trim();
    if (year && row.teamID && abbreviation) abbreviations.set(`${year}:${row.teamID}`, abbreviation);
  }
  return abbreviations;
}

function addTeam(teams, abbreviations, row) {
  const year = parseInteger(row.yearID);
  const team = abbreviations.get(`${year}:${row.teamID}`) ?? row.teamID?.trim();
  if (team) teams.add(team);
}

function formatTeams(teams) {
  return [...teams].sort().join(' / ');
}

function careerDistance(candidate, player) {
  const first = player.firstYear ?? player.lastYear ?? 0;
  const last = player.lastYear ?? player.firstYear ?? first;
  return Math.abs((candidate.firstYear ?? first) - first) + Math.abs((candidate.lastYear ?? last) - last);
}

function parseCsv(csv) {
  const [headerLine, ...lines] = csv.replace(/\r/g, '').trim().split('\n');
  const headers = parseCsvLine(headerLine ?? '');
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
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
    } else if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}

function formatName(first, last) {
  return [first?.trim(), last?.trim()].filter(Boolean).join(' ');
}

function normalizeName(value) {
  return (value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseInteger(value) {
  const parsed = Number.parseInt(value?.trim() || '0', 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseYear(value) {
  const year = Number.parseInt(value?.slice(0, 4) ?? '', 10);
  return Number.isNaN(year) ? null : year;
}

function formatAverage(value) {
  const rounded = value.toFixed(3);
  return rounded.startsWith('0') ? rounded.slice(1) : rounded;
}

function formatInnings(ipOuts) {
  const innings = Math.floor(ipOuts / 3);
  const remainder = ipOuts % 3;
  return remainder === 0 ? `${innings}` : `${innings}.${remainder}`;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
