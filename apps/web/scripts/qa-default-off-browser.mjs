#!/usr/bin/env node
/**
 * Non-destructive native Chromium acceptance of the shipped default-OFF routes.
 * Runs a built Next app locally, without Supabase, Auth, production settings or fixtures.
 * Does NOT prove hosted database, scoring submission, OAuth or mobile Safari behavior.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDefaultOffSmokeEnvironment } from './qa-default-off-browser-safety.mjs';

const playwrightPath = process.env.IB_DEFAULT_OFF_SMOKE_PLAYWRIGHT_MODULE;
assert.ok(playwrightPath && isAbsolute(playwrightPath)
  && playwrightPath.endsWith('/playwright/index.mjs'),
'IB_DEFAULT_OFF_SMOKE_PLAYWRIGHT_MODULE must be an absolute QA-only Playwright module');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const nextBinary = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));

async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) =>
    socket.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

function stop(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); }
  catch { child.kill('SIGTERM'); }
}

async function startNext() {
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath,
    [nextBinary, 'start', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: webRoot,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: createDefaultOffSmokeEnvironment(process.env, port),
    });
  // Never echo application logs. They can contain signed state or puzzle hints.
  child.stdout.resume();
  child.stderr.resume();
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(base + '/', { signal: AbortSignal.timeout(1200) });
      if (response.status === 200) return { child, base };
    } catch { /* Server is not ready yet. */ }
    await delay(250);
  }
  stop(child);
  throw new Error('Default-OFF local Next app did not return HTTP 200');
}

let child;
let browser;
try {
  const running = await startNext();
  child = running.child;
  const { base } = running;
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    try {
      // Disallow requests to analytics, remote APIs and any non-loopback origin.
      await context.route('**/*', route => {
        const requestUrl = new URL(route.request().url());
        return requestUrl.origin === base ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      const home = await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      assert.equal(home?.status(), 200, 'Default Daily home must return HTTP 200');
      await page.getByRole('heading', { name: 'Daily Nine', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Got it', exact: true }).click();
      await page.locator('.game-shell').waitFor();
      assert.equal(await page.getByRole('link', { name: 'Create a Lineup' }).count(), 0,
        'Unreleased Custom creation must not be advertised');
      await page.getByRole('link', { name: 'My Results' }).click();
      await page.getByRole('heading', { name: 'My Results', exact: true }).waitFor();
      await page.getByRole('link', { name: /Back to today.*Daily/ }).click();
      await page.getByRole('heading', { name: 'Daily Nine', exact: true }).waitFor();

      for (const path of ['/create', '/account']) {
        const response = await context.request.get(base + path);
        assert.equal(response.status(), 404, path + ' must remain default-OFF');
      }
      const classic = await context.request.get(base + '/classic', { maxRedirects: 0 });
      assert.ok([307, 308].includes(classic.status()),
        'Disabled Classic must redirect rather than become another game');
      assert.equal(new URL(classic.headers().location, base).pathname, '/');
      assert.deepEqual(pageErrors, [], 'No uncaught JavaScript errors during navigation');
    } finally {
      await context.close();
    }
  }
  console.log('PASS default-OFF native Chromium: Daily, Results, disabled routes, mobile/desktop viewports');
  console.log('Hosted Supabase, scoring, OAuth and physical-device acceptance are NOT established.');
} finally {
  await browser?.close();
  stop(child);
}
