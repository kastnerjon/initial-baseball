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
      // Choose a guaranteed different player using only publicly shown initials
      // and two known public search inputs; never inspect the hidden answer.
      const incorrectCandidate = beforeInitials === 'BR' ? 'Hank Aaron' : 'Babe Ruth';
      const searchResponse = page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/players/search'
          && response.request().method() === 'GET', { timeout: 15_000 });
      await page.getByLabel('Guess the player', { exact: true }).fill(incorrectCandidate);
      assert.equal((await searchResponse).status(), 200, 'Canonical player search must succeed');
      await page.getByRole('list', { name: 'Matching players', exact: true })
        .getByRole('button', { name: incorrectCandidate, exact: true }).click();
      const signedIncorrectResponse = page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/daily/resolve'
          && response.request().method() === 'POST', { timeout: 15_000 });
      await page.getByRole('button', { name: 'Submit Guess', exact: true }).click();
      const incorrectResponse = await signedIncorrectResponse;
      assert.equal(incorrectResponse.status(), 200, 'Real signed incorrect guess must succeed');
      const incorrect = await incorrectResponse.json();
      assert.ok(incorrect?.result?.kind === 'incorrect'
        && incorrect.result.strikeCount === 1 && incorrect.reveal === null,
      'Real resolve must return one nonterminal strike without revealing the answer');
      await page.getByRole('img', { name: '1 of 3 strikes', exact: true }).waitFor();
      await page.getByText('2 strikes left.', { exact: true }).waitFor();
      await page.getByRole('region', { name: 'Wrong guesses for this at-bat', exact: true })
        .getByText(incorrectCandidate, { exact: true }).waitFor();
      await page.getByText('1/4 hints', { exact: true }).waitFor();
      // Observe durable save before navigating to avoid testing a React effect race.
      await page.waitForFunction(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith('initial-baseball:daily:')) continue;
          try {
            const saved = JSON.parse(localStorage.getItem(key) ?? '');
            if (saved?.currentPitchIndex === 0
              && saved?.atBatState?.revealCount === 1
              && saved?.atBatState?.strikeCount === 1
              && saved?.atBatState?.wrongGuesses?.length === 1) return true;
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
      await page.getByRole('img', { name: '1 of 3 strikes', exact: true }).waitFor();
      const restoredWrongGuesses = page.getByRole('region', {
        name: 'Wrong guesses for this at-bat', exact: true,
      });
      assert.equal(await restoredWrongGuesses.locator('li').count(), 1,
        'Reload must retain exactly one wrong guess');
      assert.ok(await restoredWrongGuesses.locator('li').textContent() === incorrectCandidate,
        'Reload must preserve the selected public wrong guess without logging it');
      await page.getByRole('button', { name: 'Reveal Next Hint', exact: true }).click();
      await page.getByText('2/4 hints', { exact: true }).waitFor();
      await page.getByRole('img', { name: '1 of 3 strikes', exact: true }).waitFor();
      assert.equal(await page.locator('.revealed-hint').count(), 2,
        'Second authorized hint should render, not just increment progress');



      // Resolve one real server-signed terminal at-bat without knowing or
      // logging the hidden answer, then advance with the shared Daily engine.
      const signedGiveUpResponse = page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/daily/resolve'
          && response.request().method() === 'POST', { timeout: 15_000 });
      await page.getByRole('button', { name: 'Give up', exact: true }).click();
      await page.getByRole('button', { name: 'Yes, give up', exact: true }).click();
      assert.equal((await signedGiveUpResponse).status(), 200,
        'Signed Daily terminal give-up must be accepted before advancing');
      await page.getByRole('button', { name: 'Next At Bat', exact: true }).click();
      await page.locator('.at-bat-progress-step[aria-current="step"][aria-label="At-bat 2: current"]')
        .waitFor({ timeout: 15_000 });
      assert.equal(await page.locator('[aria-label="At-bat 1: completed"]').count(), 1,
        'Completed first at-bat must be retained');
      await page.getByText('0/4 hints', { exact: true }).waitFor();
      await page.getByRole('img', { name: '0 of 3 strikes', exact: true }).waitFor();
      assert.equal(await page.getByRole('region', {
        name: 'Wrong guesses for this at-bat', exact: true,
      }).count(), 0, 'New at-bat must not inherit the previous wrong guess');
      assert.equal(await page.locator('.revealed-hint').count(), 0,
        'New at-bat must not inherit previously revealed hints');
      await page.waitForFunction(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith('initial-baseball:daily:')) continue;
          try {
            const saved = JSON.parse(localStorage.getItem(key) ?? '');
            if (saved?.currentPitchIndex === 1
              && saved?.pendingAdvance === null
              && saved?.atBatState?.revealCount === 0
              && saved?.gameState?.completedAtBats?.length === 1) return true;
          } catch { /* Ignore unrelated local keys. */ }
        }
        return false;
      }, null, { timeout: 10_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Got it', exact: true }).click();
      await page.getByText('0/4 hints', { exact: true }).waitFor();
      assert.equal(await page.locator('.at-bat-progress-step[aria-current="step"]')
        .getAttribute('aria-label'), 'At-bat 2: current',
      'Reload must preserve advancement to the exact next at-bat');
      assert.equal(await page.locator('[aria-label="At-bat 1: completed"]').count(), 1,
        'Reload must preserve the earlier terminal result');
      assert.equal(await page.locator('.revealed-hint').count(), 0,
        'Reload must not expose prior at-bat hints on the next player');

      // Complete the remaining eight at-bats using only real signed Daily
      // give-up/resolve transitions. The browser may display revealed answers,
      // but this runner never reads or logs them, or any signed credentials.
      for (let atBat = 2; atBat <= 9; atBat++) {
        await page.locator(
          `.at-bat-progress-step[aria-current="step"][aria-label="At-bat ${atBat}: current"]`,
        ).waitFor({ timeout: 15_000 });
        await page.getByText('0/4 hints', { exact: true }).waitFor();
        const terminalResponse = page.waitForResponse(response =>
          new URL(response.url()).pathname === '/api/daily/resolve'
            && response.request().method() === 'POST', { timeout: 15_000 });
        await page.getByRole('button', { name: 'Give up', exact: true }).click();
        await page.getByRole('button', { name: 'Yes, give up', exact: true }).click();
        assert.equal((await terminalResponse).status(), 200,
          `At-bat ${atBat} must receive authoritative signed terminal admission`);
        await page.getByRole('button', {
          name: atBat === 9 ? 'View Results' : 'Next At Bat', exact: true,
        }).click();
        if (atBat < 9) {
          await page.locator(
            `.at-bat-progress-step[aria-current="step"][aria-label="At-bat ${atBat + 1}: current"]`,
          ).waitFor({ timeout: 15_000 });
          assert.equal(await page.locator(
            `[aria-label="At-bat ${atBat}: completed"]`).count(), 1,
          'The resolved at-bat must not be lost when advancing');
        }
      }
      await page.locator('.complete-card-daily h2').waitFor({ timeout: 15_000 });
      await page.getByRole('region', { name: 'Your Nine at-bat results' }).waitFor();
      await page.getByText('9 of 9 completed', { exact: true }).waitFor();
      assert.equal(await page.locator('.your-nine-row').count(), 9,
        'A finished Daily must display every resolved at-bat row');
      const finishedPoints = await page.locator('.your-nine-total strong').textContent();
      assert.ok(finishedPoints && finishedPoints.includes('PTS'),
        'The finished Daily must display a points total');
      // Final local persistence is independent of any hosted scoring backend.
      // Never print stored game state: it may contain signed checkpoints.
      await page.waitForFunction(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith('initial-baseball:daily:')) continue;
          try {
            const saved = JSON.parse(localStorage.getItem(key) ?? '');
            if (saved?.currentPitchIndex === 9
              && saved?.gameState?.completedAtBats?.length === 9
              && saved?.gameState?.status === 'completed') return true;
          } catch { /* Ignore unrelated or corrupted local keys. */ }
        }
        return false;
      }, null, { timeout: 10_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Got it', exact: true }).click();
      await page.locator('.complete-card-daily h2').waitFor({ timeout: 15_000 });
      await page.getByRole('region', { name: 'Your Nine at-bat results' }).waitFor();
      await page.getByText('9 of 9 completed', { exact: true }).waitFor();
      assert.equal(await page.locator('.your-nine-row').count(), 9,
        'Reload must retain all nine resolved at-bat rows');
      assert.equal(await page.locator('.your-nine-total strong').textContent(),
        finishedPoints, 'Reload must preserve the exact completed points total');
      assert.equal(await page.locator('.at-bat-progress-step[aria-current="step"]').count(),
        0, 'Completed Daily must not reopen an unfinished at-bat after reload');

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
  console.log('PASS default-OFF native Chromium: Daily real incorrect guess/strike/hint recovery, signed terminal advance/reload, Results, disabled Custom identity GET/POST, mobile/desktop viewports');
  console.log('Hosted Supabase, scoring, OAuth and physical-device acceptance are NOT established.');
} finally {
  await browser?.close();
  stop(child);
}
