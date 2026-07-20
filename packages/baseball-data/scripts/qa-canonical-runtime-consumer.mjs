import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFileSystemCanonicalRuntimeAccessor } from '../dist/runtime/index.js';

const runtimeDirectory = resolve('reports/canonical-runtime-payload');
const accessor = createFileSystemCanonicalRuntimeAccessor(runtimeDirectory);
const players = accessor.getPlayerIndex();
const byLahman = new Map(players.map(player => [player.lahmanPlayerId, player]));
const issues = [];

check(players.length === 13620, `Expected 13620 runtime players, found ${players.length}.`);

const representativePlayers = [
  ['ortizda01', 'David Ortiz', 'hitter', 1997, 2016],
  ['riverma01', 'Mariano Rivera', 'pitcher', 1995, 2013],
  ['ohtansh01', 'Shohei Ohtani', 'two-way', 2018, 2025],
  ['griffke02', 'Ken Griffey Jr.', 'hitter', 1989, 2010],
  ['wrighda03', 'David Wright', 'hitter', 2004, 2018],
  ['mayswi01', 'Willie Mays', 'hitter', 1948, 1973],
  ['camparo01', 'Roy Campanella', 'hitter', 1937, 1957],
];

for (const [lahmanId, displayName, playerType, firstSeason, lastSeason] of representativePlayers) {
  const index = byLahman.get(lahmanId);
  if (!index) {
    issues.push(`Missing representative player ${lahmanId}.`);
    continue;
  }
  const reveal = accessor.getReveal(index.playerId);
  check(reveal.displayName === displayName, `${lahmanId} display name mismatch.`);
  check(reveal.playerType === playerType, `${lahmanId} player type mismatch.`);
  check(reveal.career.firstSeason === firstSeason, `${lahmanId} first season mismatch.`);
  check(reveal.career.lastSeason === lastSeason, `${lahmanId} last season mismatch.`);
  check(reveal.seasons.length === reveal.career.seasonCount, `${lahmanId} season count mismatch.`);
  check(!Object.hasOwn(reveal, 'legalName'), `${lahmanId} reveal leaks legalName.`);
}

const benTaylors = ['taylobe02', 'taylobe99', 'taylobe03'].map(id => byLahman.get(id));
check(benTaylors.every(Boolean), 'One or more Ben Taylor identities are missing.');
check(new Set(benTaylors.map(player => player?.playerId)).size === 3, 'Ben Taylor identities collapsed.');

const ortiz = byLahman.get('ortizda01');
if (ortiz) {
  check(accessor.requireCanonicalPlayerId('chadwick:0fa4c972') === ortiz.playerId, 'David Ortiz legacy redirect failed.');
  check(accessor.getReveal(ortiz.playerId).career.advanced?.ops?.toFixed(3) === '0.931', 'David Ortiz OPS regression failed.');
}
const mays = byLahman.get('mayswi01');
if (mays) {
  const reveal = accessor.getReveal(mays.playerId);
  check(reveal.career.advanced?.ops === null, 'Willie Mays career OPS must remain null.');
  check(reveal.seasons.find(season => season.season === 1954)?.advanced?.ops != null, 'Willie Mays 1954 OPS is missing.');
}
const campanella = byLahman.get('camparo01');
if (campanella) {
  const reveal = accessor.getReveal(campanella.playerId);
  check(reveal.career.advanced?.ops === null, 'Roy Campanella career OPS must remain null.');
  check(reveal.seasons.find(season => season.season === 1944)?.advanced?.ops === null, 'Roy Campanella 1944 OPS must remain null.');
}

const redirectPayload = JSON.parse(readFileSync(resolve(
  runtimeDirectory,
  'legacy-redirects.json',
)));
const excluded = redirectPayload.excludedRedirects.find(entry => entry.legacyPlayerId === 'chadwick:5a9b12f9');
check(excluded?.reason === 'target_has_no_runtime_reveal', 'Expected excluded redirect is missing or changed.');
check(accessor.resolvePlayerId('chadwick:5a9b12f9').status === 'excluded', 'Excluded redirect resolved unexpectedly.');

if (issues.length > 0) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Verified ${players.length} canonical runtime players, representative records, redirects, and same-name identities.`);
}

function check(condition, message) {
  if (!condition) issues.push(message);
}
