import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateVerifiedAppearanceRows } from './verified-appearance-evidence.mjs';

const bryant = Object.freeze({
  yearID: '2025', teamID: 'COL', playerID: 'bryankr01', G_all: '11',
  sourceURL: 'https://www.mlb.com/player/kris-bryant-592178',
});
function check(rows, overrides = {}) {
  return validateVerifiedAppearanceRows({
    sourceAppearanceRows: [],
    verifiedAppearanceRows: rows,
    knownTeamSeasons: new Set(['2025|COL', '2025|BAL']),
    canonicalByLahmanId: new Map([['bryankr01', 'ibp_0123456789abcdef0123']]),
    batting: { facts: [{ lahmanPlayerId: 'bryankr01', season: 2025 }] },
    pitching: { facts: [] },
    ...overrides,
  });
}
function expectRejected(patch, match, overrides) {
  const row = { ...bryant, ...patch };
  const result = check([row], overrides);
  assert.equal(result.acceptedRows.length, 0, 'Invalid evidence reached canonical fact inputs');
  assert.ok(result.issues.some(issue => match.test(issue)), JSON.stringify(result.issues));
}
test('a verified MLB team and total games is admitted without modifying the row', () => {
  const result = check([bryant]);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.acceptedRows, [bryant]);
  assert.strictEqual(result.acceptedRows[0], bryant);
});
test('rejects partial, exponent, negative, fractional, zero, and unsafe games', () => {
  for (const G_all of ['11.5', '11x', '1e3', '-4', '0', '', '9007199254740992']) {
    expectRejected({ G_all }, /Invalid verified appearance games/);
  }
});
test('rejects malformed, out-of-range, and partially numeric years', () => {
  for (const yearID of ['2025x', '2025.0', '202', '02125', '2101', '1800']) {
    expectRejected({ yearID }, /Invalid verified appearance year/);
  }
});
test('rejects nonexistent, missing, and mismatched team-year evidence', () => {
  expectRejected({ teamID: 'ZZZ' }, /Unknown verified appearance team-season/);
  expectRejected({ teamID: '' }, /Missing verified appearance team/);
  expectRejected({}, /Unknown verified appearance team-season/, {
    knownTeamSeasons: new Set(['2024|COL']),
  });
});
test('rejects spoofed or missing MLB provenance', () => {
  for (const sourceURL of ['https://mlb.com/player/kris-bryant-592178',
    'https://www.mlb.com.evil.test/player/kris-bryant-592178',
    'https://www.mlb.com/player/kris-bryant-592178?season=2025', '']) {
    expectRejected({ sourceURL }, /Invalid verified appearance MLB provenance URL/);
  }
});
test('rejects unknown identity, missing batting/pitching season, and source overlap', () => {
  expectRejected({ playerID: 'unknown01' }, /Unknown verified appearance identity/);
  expectRejected({}, /has no batting\/pitching season/, { batting: { facts: [] } });
  expectRejected({}, /overlaps Lahman/, {
    sourceAppearanceRows: [{ playerID: 'bryankr01', yearID: '2025', teamID: 'COL' }],
  });
});
test('rejects inferred positional game counts', () => {
  expectRejected({ G_dh: '11' }, /Unverified positional appearance count/);
});
test('never admits duplicate supplement rows, while retaining the first valid row', () => {
  const duplicated = check([bryant, { ...bryant }]);
  assert.deepEqual(duplicated.acceptedRows, [bryant]);
  assert.ok(duplicated.issues.some(issue => /Duplicate verified appearance season/.test(issue)));
});
test('rejects invalid rows without affecting independent valid evidence', () => {
  const invalid = { ...bryant, G_all: '11.5' };
  const valid = { ...bryant, playerID: 'banueda01', teamID: 'BAL', G_all: '1',
    sourceURL: 'https://www.mlb.com/player/david-banuelos-675915' };
  const result = check([invalid, valid], {
    canonicalByLahmanId: new Map([['bryankr01', 'ibp_0123456789abcdef0123'],
      ['banueda01', 'ibp_0123456789abcdef0124']]),
    batting: { facts: [{ lahmanPlayerId: 'bryankr01', season: 2025 },
      { lahmanPlayerId: 'banueda01', season: 2025 }] },
  });
  assert.deepEqual(result.acceptedRows, [valid]);
  assert.ok(result.issues.some(issue => /Invalid verified appearance games/.test(issue)));
});
