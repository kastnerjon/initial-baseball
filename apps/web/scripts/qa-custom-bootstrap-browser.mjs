#!/usr/bin/env node
/** Native browser/HTTP ordering test. Simulated endpoint: never hosted/DB acceptance. */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bounded, cookieName, puzzleId, serveFixture } from './qa-custom-bootstrap-fixture.mjs';

const modulePath = process.env.CUSTOM_BOOTSTRAP_QA_PLAYWRIGHT_MODULE;
assert.ok(modulePath && isAbsolute(modulePath) && modulePath.endsWith('/playwright/index.mjs'),
  'Set CUSTOM_BOOTSTRAP_QA_PLAYWRIGHT_MODULE to an external QA-only playwright/index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
const web = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
// Use the already-installed Vitest -> Vite -> esbuild toolchain, without a new dependency.
const require = createRequire(join(web, 'package.json'));
const buildModule = process.env.CUSTOM_BOOTSTRAP_QA_ESBUILD_MODULE;
assert.ok(!buildModule || isAbsolute(buildModule), 'QA esbuild module must be absolute');
const { build } = buildModule ? require(buildModule)
  : createRequire(createRequire(require.resolve('vitest/package.json'))
    .resolve('vite/package.json'))('esbuild');
const temporary = await mkdtemp(join(tmpdir(), 'ib-bootstrap-qa-'));
let browser;
try {
  const entry = join(temporary, 'entry.ts');
  await writeFile(entry, [
    `export { createCustomLineupV2BrowserTransport } from ${JSON.stringify(join(web, 'app/customLineupV2BrowserTransport.ts'))};`,
    `export { createDailyGameplayRequestController } from ${JSON.stringify(join(web, 'app/dailyGameplayRequestController.ts'))};`,
  ].join('\n'));
  const built = await build({ entryPoints: [entry], bundle: true, write: false,
    format: 'iife', globalName: 'IBBootstrapQA', platform: 'browser',
    alias: { '@initial-baseball/engine': join(root, 'packages/engine/src/index.ts'),
      '@initial-baseball/shared': join(root, 'packages/shared/src/index.ts') } });
  const executablePath = process.env.CUSTOM_BOOTSTRAP_QA_CHROMIUM_EXECUTABLE;
  assert.ok(!executablePath || isAbsolute(executablePath), 'Chromium executable must be absolute');
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  console.log('Native Chromium ' + browser.version() + '; simulated loopback server; no database');
  for (const n of [1, 10]) {
    for (const mode of ['unlocked-control', 'two-tabs', 'close-before-headers',
      'navigate-before-headers', 'close-after-headers', 'malformed-body', 'react-invalidation']) {
      await run(n, mode, built.outputFiles[0].text);
    }
  }
  console.log('PASS 14 native-browser scenarios. Hosted/Safari/Android acceptance NOT established.');
} finally {
  await browser?.close();
  await rm(temporary, { recursive: true, force: true });
}

async function result(page, label) {
  await page.waitForFunction(label => window.results[label] !== undefined, label, { timeout: 10_000 });
  return page.evaluate(label => window.results[label], label);
}
async function start(page, label, unlocked = false, lifetime = false) {
  await page.evaluate(args => window.start(...args), [label, unlocked, lifetime]);
}
async function pendingLock(page) {
  const name = 'initial-baseball:custom-lineup-v2:bootstrap:' + puzzleId;
  await page.waitForFunction(async name => {
    const state = await navigator.locks.query();
    return state.held.some(x => x.name === name) && state.pending.some(x => x.name === name);
  }, name, { timeout: 10_000 });
}
async function cookie(context, url) {
  const matches = (await context.cookies(url + '/api/custom-lineup/challenges/' + puzzleId))
    .filter(c => c.name === cookieName);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].httpOnly, true);
  return matches[0].value;
}
async function resume(page, fixture, context, expected) {
  const key = await cookie(context, fixture.url);
  assert.equal(key, expected);
  fixture.ledger.get(key).strikes = 1;
  await page.reload(); await start(page, 'progress');
  const progress = await result(page, 'progress');
  assert.equal(progress.value.attemptProgress.strikeCount, 1);
  assert.equal(progress.value.progressionToken, 'SIMULATED-' + key + '-1');
  fixture.ledger.get(key).completed = true;
  await page.reload(); await start(page, 'completed');
  const completed = await result(page, 'completed');
  assert.equal(completed.value.attemptMode, 'completed');
  assert.equal(completed.value.completedAtBats.length, completed.value.atBats.length);
  assert.ok(!('progressionToken' in completed.value));
  assert.equal(await cookie(context, fixture.url), key);
}
async function run(n, mode, bundle) {
  const fixture = await serveFixture(bundle, n, mode === 'close-after-headers', mode === 'malformed-body');
  const context = await browser.newContext();
  // All browser traffic is restricted to this fixture's loopback origin.
  await context.route('**/*', route => new URL(route.request().url()).origin === fixture.url
    ? route.continue() : route.abort());
  try {
    const a = await context.newPage(); await a.goto(fixture.url);
    const b = mode === 'react-invalidation' ? a : await context.newPage();
    if (b !== a) await b.goto(fixture.url);
    const unlocked = mode === 'unlocked-control';
    const lifetime = mode === 'react-invalidation';
    await start(a, 'first', unlocked, lifetime);
    await bounded(fixture.firstArrived.promise);
    await start(b, 'second', unlocked, lifetime);
    if (unlocked) {
      await bounded(fixture.secondArrived.promise); await result(b, 'second');
      assert.equal(fixture.ledger.size, 2);
      assert.equal(await cookie(context, fixture.url), 'fixture-2');
      fixture.ledger.get('fixture-2').strikes = 1;
      await start(b, 'progress');
      assert.equal((await result(b, 'progress')).value.attemptProgress.strikeCount, 1);
      fixture.release.resolve(); await result(a, 'first');
      assert.equal(await cookie(context, fixture.url), 'fixture-1');
      await start(b, 'reset');
      assert.equal((await result(b, 'reset')).value.attemptProgress.strikeCount, 0);
    } else {
      await pendingLock(b);
      assert.equal(fixture.requests.length, 1);
      const interrupted = mode.startsWith('close-') || mode.startsWith('navigate-');
      if (interrupted) {
        if (mode.startsWith('close-')) await a.close();
        else await a.goto(fixture.url + '/away');
        await result(b, 'second');
        await bounded(fixture.firstConnectionClosed.promise);
        const surviving = await cookie(context, fixture.url);
        fixture.ledger.get(surviving).strikes = 1;
        fixture.release.resolve(); await bounded(fixture.firstFinished.promise);
        // A fresh round-trip observes browser/network work after the late server response.
        await start(b, 'after-late-response'); await result(b, 'after-late-response');
        assert.equal(await cookie(context, fixture.url), surviving);
        assert.equal((await result(b, 'after-late-response')).value.attemptProgress.strikeCount, 1);
        assert.equal(fixture.ledger.size, mode === 'close-after-headers' ? 1 : 2);
        await resume(b, fixture, context, surviving);
      } else {
        fixture.release.resolve();
        await result(b, 'second');
        if (lifetime) {
          assert.equal(await a.evaluate(() => window.view.label), 'second');
          assert.equal(await a.evaluate(() => window.results.first), undefined);
        } else {
          const first = await result(a, 'first');
          if (mode === 'malformed-body') assert.equal(first.error, 'invalid_response');
          else assert.ok(first.value);
        }
        assert.equal(fixture.ledger.size, 1);
        assert.equal(fixture.requests[1].cookie, 'fixture-1');
        await resume(b, fixture, context, 'fixture-1');
      }
    }
    console.log('PASS N=' + n + ' ' + mode + ' issued=' + fixture.ledger.size);
  } finally {
    await context.close(); await fixture.close();
  }
}
