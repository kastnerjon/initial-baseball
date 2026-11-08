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
import { assertNoImplicitNextEnvironmentFiles, createDefaultOffSmokeEnvironment } from './qa-default-off-browser-safety.mjs';

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
  await assertNoImplicitNextEnvironmentFiles(webRoot);
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath,
    [nextBinary, 'start', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: webRoot,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: createDefaultOffSmokeEnvironment(process.env, port),
    });
  // A random 200 on the reserved port is not proof that our own Next child
  // successfully bound it. Require this child's explicit startup readiness.
  // Never echo application logs: they may include signed state or puzzle hints.
  let childReady = false;
  let outputTail = '';
  child.stdout.on('data', chunk => {
    outputTail = (outputTail + chunk.toString()).slice(-2048);
    if (/(?:^|\r|\n)[^\r\n]*\bReady in\s+/.test(outputTail)) childReady = true;
  });
  child.stderr.resume();
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) break;
    if (childReady) {
      try {
        const response = await fetch(base + '/', { signal: AbortSignal.timeout(1200) });
        if (response.status === 200 && child.exitCode === null && child.signalCode === null) {
          return { child, base };
        }
      } catch { /* Child has not begun responding yet. */ }
    }
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
    context.setDefaultTimeout(10_000);
    context.setDefaultNavigationTimeout(20_000);
    try {
      // Disallow requests to analytics, remote APIs and any non-loopback origin.
      await context.route('**/*', route => {
        const requestUrl = new URL(route.request().url());
        return requestUrl.origin === base ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const pageErrors = [];
      let restoredHintRequestStatus = null;
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('response', response => {
        if (new URL(response.url()).pathname === '/api/daily/hints'
          && response.request().method() === 'POST') {
          restoredHintRequestStatus = response.status();
        }
      });
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
      await page.getByRole('button', { name: 'Got it', exact: true }).click();

      // Real signed Daily hint consumption and browser persistence, no hosted DB.
      const beforeInitials = await page.locator('.initials-value').textContent();
      const beforeAtBat = await page.locator('.at-bat-progress-step[aria-current="step"]')
        .getAttribute('aria-label');
      assert.ok(beforeAtBat, 'The initial Daily at-bat must be identifiable');
      await page.getByText('0/4 hints', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Reveal Next Hint', exact: true }).click();
      await page.getByText('1/4 hints', { exact: true }).waitFor();
      const beforeHint = await page.locator('.revealed-hint .hint-value').first().textContent();
      assert.ok(beforeHint && beforeHint.trim(), 'First authorized hint should render');
      // Observe durable save before navigating to avoid testing a React effect race.
      await page.waitForFunction(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith('initial-baseball:daily:')) continue;
          try {
            const saved = JSON.parse(localStorage.getItem(key) ?? '');
            if (saved?.atBatState?.revealCount === 1) return true;
          } catch { /* Ignore unrelated or corrupted local keys. */ }
        }
        return false;
      }, null, { timeout: 10_000 });
      // Register before navigation: earlier hint POSTs must never satisfy
      // the post-reload authorization proof.
      const resumedHintResponse = page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/daily/hints'
          && response.request().method() === 'POST', { timeout: 15_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Got it', exact: true }).click();
      try {
        await page.getByText('1/4 hints', { exact: true }).waitFor();
      } catch {
        // State-only diagnostics: do not emit names, hint values or signed tokens.
        const state = await page.evaluate(() => {
          const text = document.body.textContent ?? '';
          return {
            progress: document.querySelector('.hint-progress')?.textContent ?? null,
            restoring: text.includes('Restoring today'),
            restoreError: text.includes('The saved at-bat could not be restored'),
            follower: text.includes('active in another tab'),
            blocked: text.includes('could not be restored safely'),
          };
        });
        throw new Error('Signed Daily hint restore failed. State: '
          + JSON.stringify(state) + '; hint endpoint HTTP: '
          + String(restoredHintRequestStatus));
      }
      assert.equal((await resumedHintResponse).status(), 200,
        'The post-reload signed Daily hint recovery POST must succeed');
      assert.ok(await page.locator('.initials-value').textContent() === beforeInitials,
        'Reload must not change the active player');
      assert.equal(await page.locator('.at-bat-progress-step[aria-current="step"]')
        .getAttribute('aria-label'), beforeAtBat,
      'Reload must not change the active at-bat');
      assert.ok(await page.locator('.revealed-hint .hint-value').first().textContent() === beforeHint,
        'Reload must preserve the exact authorized hint without exposing it in logs');
      assert.equal(await page.locator('.revealed-hint').count(), 1,
        'Reload must not replay or duplicate previous hints');
      await page.getByRole('button', { name: 'Reveal Next Hint', exact: true }).click();
      await page.getByText('2/4 hints', { exact: true }).waitFor();
      assert.equal(await page.locator('.revealed-hint').count(), 2,
        'Second authorized hint should render, not just increment progress');


      // Both identity flags remain OFF, including when a later source PR adds
      // GET/POST routes. No signed browser cookie or private DB is available.
      const challenge = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
      const displayUrl = base + '/api/custom-lineup/challenges/' + challenge
        + '/completion/display';
      const hiddenGet = await context.request.get(displayUrl, { timeout: 15_000 });
      assert.equal(hiddenGet.status(), 404, 'Completion display GET must remain default-OFF');
      const hiddenPost = await context.request.post(displayUrl, {
        data: { mode: 'named', displayName: 'QA Guest' },
        headers: { origin: base }, timeout: 15_000,
      });
      assert.equal(hiddenPost.status(), 404, 'Completion display POST must remain default-OFF');

      for (const path of ['/create', '/account']) {
        const response = await context.request.get(base + path, { timeout: 15_000 });
        assert.equal(response.status(), 404, path + ' must remain default-OFF');
      }
      const classic = await context.request.get(base + '/classic', { maxRedirects: 0, timeout: 15_000 });
      assert.ok([307, 308].includes(classic.status()),
        'Disabled Classic must redirect rather than become another game');
      assert.equal(new URL(classic.headers().location, base).pathname, '/');
      assert.deepEqual(pageErrors, [], 'No uncaught JavaScript errors during navigation');
    } finally {
      await context.close();
    }
  }
  console.log('PASS default-OFF native Chromium: Daily signed hint restore, Results, disabled Custom identity GET/POST, mobile/desktop viewports');
  console.log('Hosted Supabase, scoring, OAuth and physical-device acceptance are NOT established.');
} finally {
  await browser?.close();
  stop(child);
}
