import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('./.next/server/app-paths-manifest.json', import.meta.url), 'utf8'));
const expected = [
  '/.well-known/oauth-protected-resource/route',
  '/api/official-daily/mcp/route',
  '/api/official-daily/oauth/decision/route',
  '/oauth/consent/route',
];
// Next may emit its own error page for an otherwise route-only application.
assert.deepEqual(Object.keys(manifest).filter(path => path !== '/_not-found/page').sort(), expected);
const pages = JSON.parse(readFileSync(new URL('./.next/server/pages-manifest.json', import.meta.url), 'utf8'));
assert.deepEqual(Object.keys(pages).filter(path => !['/_app', '/_document', '/_error', '/404', '/500'].includes(path)), []);
console.log('Editor QA build contains only the four approved editor routes.');
