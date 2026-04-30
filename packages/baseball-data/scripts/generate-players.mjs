import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const PEOPLE_SHARDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
const PEOPLE_URL = 'https://raw.githubusercontent.com/chadwickbureau/register/master/data/people-';
const NAMES_URL = 'https://raw.githubusercontent.com/chadwickbureau/register/master/data/names.csv';
const OUTPUT_PATH = resolve(process.cwd(), 'src/generated/players.json');

const peopleRows = [];
for (const shard of PEOPLE_SHARDS) {
  const csv = await fetchText(`${PEOPLE_URL}${shard}.csv`);
  peopleRows.push(...parseCsv(csv));
}

const nameRows = parseCsv(await fetchText(NAMES_URL));
const aliasesByPersonId = buildAliasesByPersonId(nameRows);

const players = peopleRows
  .filter(isEligiblePlayer)
  .map((row) => buildPlayer(row, aliasesByPersonId.get(row.key_person) ?? []))
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

function isEligiblePlayer(row) {
  const mlbFirst = parseYear(row.mlb_played_first);
  const mlbLast = parseYear(row.mlb_played_last);
  const hasMlbYears = mlbFirst !== null || mlbLast !== null;

  if (!hasMlbYears) {
    return false;
  }

  return (mlbFirst ?? mlbLast ?? 0) >= 1950 || (mlbLast ?? mlbFirst ?? 0) >= 1950;
}

function buildPlayer(row, aliases) {
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

  return {
    id: `chadwick:${row.key_person}`,
    fullName,
    displayName,
    primaryRole: 'hitter',
    primaryPosition: 'Unknown',
    mainDecade: mainYear === null ? 'Unknown' : `${Math.floor(mainYear / 10) * 10}s`,
    teamsDisplay: '',
    aliases: [...new Set([...(legalName && legalName !== fullName ? [legalName] : []), ...(row.name_nick ? splitNicknames(row.name_nick) : []), ...aliases])]
      .filter((alias) => alias && alias !== fullName && alias !== displayName)
      .sort(),
  };
}

function formatName({ first, last, suffix }) {
  return [first?.trim(), last?.trim(), suffix?.trim()].filter(Boolean).join(' ');
}

function parseYear(value) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function splitNicknames(value) {
  return value
    .split(/[;/]/)
    .map((nickname) => nickname.trim())
    .filter(Boolean);
}
