import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MAX_LINES = 500;
const INCLUDE = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', '.expo', 'coverage']);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

let failed = false;
for (const file of walk(ROOT)) {
  const ext = file.slice(file.lastIndexOf('.'));
  if (!INCLUDE.has(ext)) continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n').length;
  if (lines > MAX_LINES) {
    failed = true;
    console.error(`File too large: ${file.replace(ROOT + '/', '')} has ${lines} lines`);
  }
}

if (failed) process.exit(1);
console.log('File size check passed.');
