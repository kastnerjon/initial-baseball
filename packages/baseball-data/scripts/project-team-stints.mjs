// Deliberate offline source refresh only; normal builds read committed TeamStints.csv.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './team-display-identities.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'data/lahman/team-stints-source.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const paths = process.argv.slice(2);
if (paths.length !== 2) throw new Error('Provide pinned full Lahman Batting.csv and Pitching.csv paths.');
const appearances = new Map();
for (const row of parseCsv(readFileSync(resolve(root, 'data/lahman/Appearances.csv'), 'utf8'))) {
  const key = row.playerID + ':' + row.yearID;
  const teams = appearances.get(key) ?? new Set();
  teams.add(row.teamID);
  appearances.set(key, teams);
}
const sequences = new Map();
for (const [i, path] of paths.entries()) {
  const bytes = readFileSync(path);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  if (checksum !== manifest.sources[i].sha256) throw new Error('Source checksum mismatch: ' + path);
  for (const row of parseCsv(bytes.toString('utf8').replace(/^\uFEFF/, ''))) {
    const key = row.playerID + ':' + row.yearID;
    if ((appearances.get(key)?.size ?? 0) < 2) continue;
    const stint = Number(row.stint);
    if (!Number.isInteger(stint) || stint < 1) throw new Error('Invalid stint: ' + key);
    const sequence = sequences.get(key) ?? new Map();
    if (sequence.has(stint) && sequence.get(stint) !== row.teamID) throw new Error('Conflicting stint: ' + key);
    sequence.set(stint, row.teamID);
    sequences.set(key, sequence);
  }
}
const rows = ['playerID,yearID,stint,teamID'];
for (const [key, teams] of [...appearances].sort(([a], [b]) => a.localeCompare(b))) {
  if (teams.size < 2) continue;
  const sequence = sequences.get(key);
  const observed = new Set(sequence?.values());
  if (observed.size !== teams.size || [...teams].some(team => !observed.has(team))) {
    throw new Error('Incomplete source sequence: ' + key);
  }
  const [player, year] = key.split(':');
  for (const [stint, team] of [...sequence].sort(([a], [b]) => a - b)) {
    rows.push([player, year, stint, team].join(','));
  }
}
writeFileSync(resolve(root, 'data/lahman/TeamStints.csv'), rows.join('\n') + '\n');
console.log('Projected ' + (rows.length - 1) + ' sourced team stints.');
