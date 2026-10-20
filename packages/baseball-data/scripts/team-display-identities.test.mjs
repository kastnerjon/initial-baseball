import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildTeamDisplayIdentityIndex, buildTeamStintIndex, parseCsv,
  collapseChronologicalTeamStints, collapseCareerTeamDisplayIdentities,
  resolveTeamDisplayIdentities,
} from './team-display-identities.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index = buildTeamDisplayIdentityIndex(read('data/lahman/Teams.csv'));
const stintIndex = buildTeamStintIndex(read('data/lahman/TeamStints.csv'));
const appearances = parseCsv(read('data/lahman/Appearances.csv'));

function seasonsFor(lahmanPlayerId) {
  const seasons = new Map();
  for (const row of appearances.filter(row => row.playerID === lahmanPlayerId)) {
    const year = Number(row.yearID);
    const teams = seasons.get(year) ?? [];
    teams.push(row.teamID);
    seasons.set(year, teams);
  }
  return [...seasons].map(([season, teamIds]) => ({
    season, teamIdentities: resolveTeamDisplayIdentities({
      season, teamIds, index, lahmanPlayerId, stintIndex,
    }),
  }));
}
const abbreviations = identities => identities.map(team => team.abbreviation);

test('Bobby Abreu has PHI then NYY in 2006 and no fabricated career returns', () => {
  const seasons = seasonsFor('abreubo01');
  assert.deepEqual(abbreviations(seasons.find(row => row.season === 2006).teamIdentities), ['PHI', 'NYY']);
  assert.deepEqual(abbreviations(collapseCareerTeamDisplayIdentities(seasons)),
    ['HOU', 'PHI', 'NYY', 'LAA', 'LAD', 'NYM']);
});

test('three-team season follows stints rather than alphabetic team codes', () => {
  const season = seasonsFor('piazzmi01').find(row => row.season === 1998);
  assert.deepEqual(abbreviations(season.teamIdentities), ['LAD', 'FLA', 'NYM']);
});

test('genuine later career returns and same-season returns survive', () => {
  const rickey = abbreviations(collapseCareerTeamDisplayIdentities(seasonsFor('henderi01')));
  assert.deepEqual(rickey.slice(0, 5), ['OAK', 'NYY', 'OAK', 'TOR', 'OAK']);
  assert.equal(rickey.at(-1), 'LAD');
  const alyea = seasonsFor('alyeabr01').find(row => row.season === 1972);
  assert.deepEqual(abbreviations(alyea.teamIdentities), ['OAK', 'STL', 'OAK']);
});

test('newly generated Teams hints match sourced canonical reveal chronology', () => {
  const players = JSON.parse(read('src/generated/players.json'));
  const overrides = JSON.parse(read('src/generated/team-history-overrides.json'));
  for (const [name, id] of [['Bobby Abreu', 'abreubo01'], ['Mike Piazza', 'piazzmi01'], ['Rickey Henderson', 'henderi01']]) {
    const player = players.find(player => player.displayName === name);
    assert.ok(player, name);
    assert.equal(overrides[player.id] ?? player.teamsDisplay,
      abbreviations(collapseCareerTeamDisplayIdentities(seasonsFor(id))).join(', '));
  }
});

test('all multi-team appearance seasons have complete source ordering', () => {
  const byPlayer = new Set(appearances.map(row => row.playerID));
  // Verify the same strict resolver used by both generation consumers.
  const bySeason = new Map();
  for (const row of appearances) {
    const key = row.playerID + ':' + row.yearID;
    const entry = bySeason.get(key) ?? { season: Number(row.yearID), lahmanPlayerId: row.playerID, teamIds: [] };
    entry.teamIds.push(row.teamID);
    bySeason.set(key, entry);
  }
  assert.ok(byPlayer.size > 10000);
  for (const season of bySeason.values()) {
    assert.doesNotThrow(() => resolveTeamDisplayIdentities({ ...season, index, stintIndex }));
  }
});

test('unknown or incomplete multi-team order fails instead of inventing chronology', () => {
  const season = { season: 2006, teamIds: ['NYA', 'PHI'], index, lahmanPlayerId: 'abreubo01' };
  assert.throws(() => resolveTeamDisplayIdentities(season), /Missing or incomplete/);
  assert.throws(() => resolveTeamDisplayIdentities({ ...season, stintIndex: new Map() }), /Missing or incomplete/);
  assert.throws(() => resolveTeamDisplayIdentities({ ...season, teamIds: ['NYA', 'PHI', 'BOS'], stintIndex }), /Missing or incomplete/);
});

test('conflicting or invalid source stints fail closed', () => {
  assert.throws(() => buildTeamStintIndex('playerID,yearID,stint,teamID\np,2000,1,BOS\np,2000,1,NYA\n'), /Conflicting/);
  assert.throws(() => buildTeamStintIndex('playerID,yearID,stint,teamID\np,2000,0,BOS\n'), /Invalid/);
});

test('collapse preserves supplied within-year sequence and adjacent abbreviation changes', () => {
  const history = [
    { year: 2011, abbreviation: 'A' },
    { year: 2010, abbreviation: 'B' },
    { year: 2010, abbreviation: 'A' },
    { year: 2012, abbreviation: 'C' },
  ];
  assert.deepEqual(abbreviations(collapseChronologicalTeamStints(history)), ['B', 'A', 'C']);
  const crawford = abbreviations(collapseCareerTeamDisplayIdentities(seasonsFor('crawfca02')));
  assert.ok(crawford.join(', ').includes('TBD, TBR'));
});
