import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { collapseChronologicalTeamStints } from './team-display-identities.mjs';

const PEOPLE_SHARDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
const PEOPLE_URL = 'https://raw.githubusercontent.com/chadwickbureau/register/master/data/people-';
const NAMES_URL = 'https://raw.githubusercontent.com/chadwickbureau/register/master/data/names.csv';
const OUTPUT_PATH = resolve(process.cwd(), 'src/generated/players.json');
const TEAM_OVERRIDES_PATH = resolve(process.cwd(), 'src/generated/team-history-overrides.json');
const LAHMAN_DIR = resolve(process.cwd(), 'data/lahman');
const LAHMAN_PEOPLE_PATH = resolve(LAHMAN_DIR, 'People.csv');
const LAHMAN_APPEARANCES_PATH = resolve(LAHMAN_DIR, 'Appearances.csv');
const LAHMAN_BATTING_PATH = resolve(LAHMAN_DIR, 'Batting.csv');
const LAHMAN_HALL_OF_FAME_PATH = resolve(LAHMAN_DIR, 'HallOfFame.csv');
const LAHMAN_PITCHING_PATH = resolve(LAHMAN_DIR, 'Pitching.csv');
const LAHMAN_TEAMS_PATH = resolve(LAHMAN_DIR, 'Teams.csv');
const EMPTY_STAT_VALUE = 'â€”';
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
  peo¶»§q«^