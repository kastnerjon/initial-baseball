#!/usr/bin/env node
/** Mounted production component with synthetic loopback HTTP only; no Auth or DB proof. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const playwrightPath = process.env.IB_DEFAULT_OFF_SMOKE_PLAYWRIGHT_MODULE;
assert.ok(playwrightPath && isAbsolute(playwrightPath)
  && playwrightPath.endsWith('/playwright/index.mjs'),
'IB_DEFAULT_OFF_SMOKE_PLAYWRIGHT_MODULE must be an absolute QA-only Playwright module');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const webRoot = fileURLToPath(new URL('../apps/web/', import.meta.url));
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
// Reuse the existing Vitest -> Vite -> esbuild toolchain, without a runtime dependency.
const vitestRequire = createRequire(webRequire.resolve('vitest/package.json'));
const viteRequire = createRequire(vitestRequire.resolve('vite'));
const { build } = viteRequire('esbuild');
const bundle = await build({
  stdin: {
    contents: `import React from 'react';
      import { createRoot } from 'react-dom/client';
      import App from './app/account/creations/MyCreationsClient';
      createRoot(document.getElementById('root')).render(<App />);`,
    resolveDir: webRoot, loader: 'tsx',
  },
  bundle: true, write: false, platform: 'browser', format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' },
});
assert.equal(bundle.outputFiles.length, 1, 'Expected one in-memory component bundle');
const server = createServer((request, response) => {
  response.setHeader('cache-control', 'no-store');
  if (request.method === 'GET' && request.url === '/app.js') {
    response.setHeader('content-type', 'application/javascript');
    response.end(bundle.outputFiles[0].text);
  } else if (request.method === 'GET' && request.url === '/') {
    response.setHeader('content-type', 'text/html');
    response.end('<!doctype html><html><head><meta charset="utf-8"></head>'
      + '<body><div id="root"></div><script src="/app.js"></script></body></html>');
  } else {
    response.writeHead(404).end();
  }
});
server.requestTimeout = 10_000;
server.headersTimeout = 10_000;

const puzzleId = index => 'custom-lineup-v2-123e4567-e89b-42d3-a456-'
  + index.toString(16).padStart(12, '0');
const creation = index => ({
  puzzleId: puzzleId(index), title: 'Synthetic lineup ' + index,
  issuedAt: '2026-11-10T12:00:00Z',
});

let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Loopback fixture startup timed out')), 5_000);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.listen(0, '127.0.0.1', () => { clearTimeout(timeout); resolve(); });
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Fixture must bind loopback');
  const base = 'http://127.0.0.1:' + address.port;
  browser = await chromium.launch({ headless: true, timeout: 20_000 });
  let scenarios = 0;
  for (const width of [390, 1280]) {
    for (const switched of [false, true]) {
      for (const empty of [false, true]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 }, serviceWorkers: 'block',
        });
        context.setDefaultTimeout(10_000);
        context.setDefaultNavigationTimeout(15_000);
        try {
          let firstRequests = 0;
          let olderRequests = 0;
          await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== base) return route.abort();
            if (url.pathname !== '/api/account/creations') return route.continue();
            assert.equal(route.request().method(), 'GET', 'Pagination must remain read-only');
            const older = url.searchParams.has('cursor');
            if (older) {
              assert.equal(url.search, '?cursor=synthetic-cursor', 'Retain exact cursor');
              olderRequests++;
            } else firstRequests++;
            return route.fulfill({ json: {
              accountScope: (older && switched ? 'b' : 'a').repeat(64),
              creations: older ? (empty ? [] : [creation(40)])
                : Array.from({ length: 40 }, (_, index) => creation(index)),
              nextCursor: older ? null : 'synthetic-cursor',
            } });
          });
          const page = await context.newPage();
          const pageErrors = [];
          page.on('pageerror', () => pageErrors.push('uncaught component error'));
          assert.equal((await page.goto(base, { waitUntil: 'domcontentloaded' }))?.status(), 200);
          await page.getByRole('button', { name: 'Show older lineups', exact: true }).waitFor();
          assert.equal(await page.locator('li').count(), 40, 'First page must show 40 rows');
          await page.getByRole('button', { name: 'Show older lineups', exact: true }).click();
          if (switched) {
            await page.getByRole('link', { name: 'Reload your creations', exact: true }).waitFor();
            assert.equal(await page.locator('li').count(), 0, 'Account switch must clear all rows');
            assert.equal(await page.getByRole('link', { name: 'Reload your creations' })
              .getAttribute('href'), '/account/creations');
          } else {
            await page.waitForFunction(count => document.querySelectorAll('li').length === count,
              empty ? 40 : 41);
            const olderRow = page.locator('li').filter({ hasText: 'Synthetic lineup 40' });
            assert.equal(await olderRow.count(), empty ? 0 : 1);
            if (!empty) assert.equal(await olderRow.getByRole('link', { name: 'Open friend link' })
              .getAttribute('href'), '/custom/' + puzzleId(40));
            assert.equal(await page.getByRole('link', { name: 'Reload your creations' }).count(), 0);
          }
          await page.getByRole('button', { name: /Show older lineups|Loading older lineups/ })
            .waitFor({ state: 'detached' });
          assert.equal(firstRequests, 1, 'One initial read per fresh browser context');
          assert.equal(olderRequests, 1, 'One later-page read per click');
          assert.deepEqual(pageErrors, [], 'Component must not throw');
          scenarios++;
        } finally { await context.close(); }
      }
    }
  }
  assert.equal(scenarios, 8);
  console.log('PASS My Creations: 8 mounted Chromium pagination/account-switch scenarios at 390px/1280px.');
  console.log('Synthetic loopback HTTP only; hosted Auth, Supabase and physical-device acceptance are NOT established.');
} finally {
  try { await browser?.close(); }
  finally {
    server.closeAllConnections();
    if (server.listening) await new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
  }
}
