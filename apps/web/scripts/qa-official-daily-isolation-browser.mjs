#!/usr/bin/env node
/** Native localStorage/Web Locks acceptance; not hosted gameplay or score admission. */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { date, ids, serveIsolationFixture } from './qa-official-daily-isolation-fixture.mjs';
import { createIsolationBrowserEnvironment, isIsolationFixtureRequestAllowed } from './qa-official-daily-isolation-safety.mjs';

const modulePath = process.env.DAILY_ISOLATION_QA_PLAYWRIGHT_MODULE;
assert.ok(modulePath && isAbsolute(modulePath) && modulePath.endsWith('/playwright/index.mjs'),
  'Set DAILY_ISOLATION_QA_PLAYWRIGHT_MODULE to an external QA-only playwright/index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
const web = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(join(web, 'package.json'));
const { build } = createRequire(createRequire(require.resolve('vitest/package.json'))
  .resolve('vite/package.json'))('esbuild');
const executablePath = process.env.DAILY_ISOLATION_QA_CHROMIUM_EXECUTABLE;
assert.ok(!executablePath || isAbsolute(executablePath), 'Chromium executable must be absolute');
const temporary = await mkdtemp(join(tmpdir(), 'ib-daily-isolation-qa-'));
let browser;
let fixture;
try {
  const entry = join(temporary, 'entry.ts');
  await writeFile(entry, [
    ['dailyModeStorage.ts', ['getDailyModeStorage']],
    ['dailyClientState.ts', ['createInitialDailyGameState', 'createInitialAtBatUiState']],
    ['dailyLocalStorage.ts', ['saveDailyGame', 'loadSavedDailyGame', 'clearSavedDailyGame']],
    ['dailyAtBatOwnershipCoordinator.ts', ['createBrowserDailyAtBatOwnershipCoordinator']],
  ].map(([path, names]) => `export { ${names.join(',')} } from ${JSON.stringify(join(web, 'app', path))};`)
    .join('\n'));
  const built = await build({ entryPoints: [entry], bundle: true, write: false,
    format: 'iife', globalName: 'IBDailyIsolationQA', platform: 'browser',
    alias: { '@initial-baseball/engine': join(root, 'packages/engine/src/index.ts'),
      '@initial-baseball/shared': join(root, 'packages/shared/src/index.ts') } });
  fixture = await serveIsolationFixture(built.outputFiles[0].text);
  browser = await chromium.launch({ headless: true, env: createIsolationBrowserEnvironment(process.env),
    ...(executablePath ? { executablePath } : {}) });
  console.log('Native Chromium ' + browser.version() + '; loopback storage/locks; no database');
  for (const width of [390, 1280]) await run(width);
  console.log('PASS mobile/desktop save, reload, switch, reset and cross-tab lock isolation.');
  console.log('Hosted gameplay, signed HTTP, score admission, Safari/Android NOT established.');
} finally {
  await browser?.close(); await fixture?.close();
  await rm(temporary, { recursive: true, force: true });
}

async function open(context, edition) {
  const page = await context.newPage();
  await page.goto(fixture.url + '/?edition=' + edition);
  await page.waitForFunction(() => window.ready === true);
  return page;
}
async function reload(page) {
  await page.reload(); await page.waitForFunction(() => window.ready === true);
}
async function state(page) { return page.evaluate(() => window.read()); }
async function owner(page) {
  await page.waitForFunction(() => window.coordinator.getState().status === 'owner');
}
async function run(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.route('**/*', route => isIsolationFixtureRequestAllowed(route.request().url(), fixture.url)
    ? route.continue() : route.abort());
  try {
    const pages = await Promise.all([0, 1, 2].map(i => open(context, i)));
    const [a, b, primary] = pages;
    // Poison legacy namespaces: new editions must neither adopt nor remove them.
    await a.evaluate(date => {
      localStorage.setItem('initial-baseball:daily:' + date, 'legacy-v3-fixture');
      localStorage.setItem('initial-baseball:daily:ruleset:points-v4:' + date,
        JSON.stringify({ puzzleId: 'another-primary', sentinel: true }));
    }, date);
    for (const page of pages) assert.equal(await state(page), null);
    for (let i = 0; i < pages.length; i++) {
      assert.equal(await pages[i].evaluate(([hints, strikes]) => window.save(hints, strikes),
        [i + 1, i % 2]), true);
    }
    await Promise.all(pages.map(reload));
    const snapshots = await Promise.all(pages.map(state));
    for (let i = 0; i < pages.length; i++) {
      assert.equal(snapshots[i].puzzleId, ids[i]);
      assert.equal(snapshots[i].atBatState.revealCount, i + 1);
      assert.equal(snapshots[i].atBatState.strikeCount, i % 2);
      assert.equal(snapshots[i].atBatState.revealedHints.length, i + 1);
    }
    // A changed save is durable while all other exact snapshots remain byte-equivalent.
    assert.equal(await a.evaluate(() => window.save(4, 2)), true);
    await reload(b); await reload(primary);
    assert.deepEqual(await state(b), snapshots[1]);
    assert.deepEqual(await state(primary), snapshots[2]);
    // Navigate the same tab both ways to exercise identity switching on one origin.
    await a.goto(fixture.url + '/?edition=1');
    await a.waitForFunction(() => window.ready === true);
    assert.deepEqual(await state(a), snapshots[1]);
    await a.goto(fixture.url + '/?edition=0');
    await a.waitForFunction(() => window.ready === true);
    assert.equal((await state(a)).atBatState.revealCount, 4);
    assert.equal(await a.evaluate(() => window.reset()), true);
    assert.equal(await state(a), null);
    assert.deepEqual(await state(b), snapshots[1]);
    assert.deepEqual(await state(primary), snapshots[2]);
    assert.deepEqual(await a.evaluate(date => [
      localStorage.getItem('initial-baseball:daily:' + date),
      JSON.parse(localStorage.getItem('initial-baseball:daily:ruleset:points-v4:' + date)),
    ], date), ['legacy-v3-fixture', { puzzleId: 'another-primary', sentinel: true }]);
    // Distinct editions own real browser locks concurrently; exact-ID duplicate waits.
    await Promise.all(pages.map(page => page.evaluate(() => window.claim())));
    await Promise.all(pages.map(owner));
    const follower = await open(context, 0);
    await follower.evaluate(() => window.claim());
    await follower.waitForFunction(async () => (await navigator.locks.query()).pending.length === 1);
    assert.equal(await follower.evaluate(() => window.coordinator.getState().status), 'follower');
    assert.equal(await a.evaluate(() => window.save(2, 1)), true);
    await a.close();
    await owner(follower);
    assert.equal(await follower.evaluate(() => window.reloaded.atBatState.revealCount), 2);
    assert.equal(await follower.evaluate(() => window.reloaded.atBatState.strikeCount), 1);
    assert.equal(await b.evaluate(() => window.coordinator.getState().status), 'owner');
    assert.equal(await primary.evaluate(() => window.coordinator.getState().status), 'owner');
    assert.deepEqual(await state(b), snapshots[1]);
    assert.deepEqual(await state(primary), snapshots[2]);
    console.log('PASS viewport=' + width + ' three identities, same-ID follower handoff');
  } finally { await context.close(); }
}
