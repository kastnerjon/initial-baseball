import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collapseChronologicalTeamStints,
  collapseCareerTeamDisplayIdentities,
  resolveTeamDisplayIdentities,
} from './team-display-identities.mjs';

test('all career clubs remain and later return stints are preserved', () => {
  const expected = ['OAK', 'NYY', 'OAK', 'TOR', 'OAK', 'SDP', 'ANA', 'SDP', 'OAK', 'NYN', 'SEA', 'SDP', 'BOS', 'LAD'];
  const history = expected.map((abbreviation, index) => ({ year: 1980 + index, abbreviation }));
  history.push({ year: 1994, abbreviation: 'LAD' });
  assert.deepEqual(collapseChronologicalTeamStints(history).map(x => x.abbreviation), expected);
});

test('same-club repeated years collapse while returns remain after other clubs', () => {
  const history = [
    { year: 2012, abbreviation: 'C' },
    { year: 2010, abbreviation: 'B' },
    { year: 2010, abbreviation: 'A' },
    { year: 2011, abbreviation: 'A' },
    { year: 2012, abbreviation: 'A' },
  ];
  assert.deepEqual(collapseChronologicalTeamStints(history).map(x => x.abbreviation), ['A', 'B', 'A', 'C']);
});

test('career identity chronology is not alphabetized and preserves returns', () => {
  const seasons = [
    { season: 2002, teamIdentities: [{ abbreviation: 'TOR', displayName: 'Toronto' }] },
    { season: 2003, teamIdentities: [{ abbreviation: 'BOS', displayName: 'Boston' }] },
    { season: 2004, teamIdentities: [{ abbreviation: 'BOS', displayName: 'Boston' }] },
    { season: 2005, teamIde¶»§q«^