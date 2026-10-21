#!/usr/bin/env node
/** Staged creator UI acceptance. Browser mocks all issuance and search; never uses a database. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const modulePath = process.env.CUSTOM_CREATOR_BROWSER_QA_PLAYWRIGHT_MODULE;
assert.ok(modulePath && isAbsolute(modulePath) && modulePath.endsWith('/playwright/index.mjs'),
  'Set CUSTOM_CREATOR_BROWSER_QA_PLAYWRIGHT_MODULE to a QA-only absolute playwright/index.mjs path');
const { chromium } = await import(pathToFileURL(modulePath).href);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const ownerCode = 'a'.repeat(43);
const puzzleId = 'custom-lineup-v2-00000000-0000-4000-8000-000000000001';
const widths = [320, 375, 390, 430, 768, 1280];
const candidates = [
  ['Derek Jeter', 1995, 2014, 'NYY'],
  ['Albert Pujols', 2001, 2022, 'STL, LAA, LAD'],
  ['Ken Griffey Jr.', 1989, 2010, 'SEA, CIN, CHW'],
  ['Ichiro Suzuki', 2001, 2019, 'SEA, NYY, MIA'],
  ['David Ortiz', 1997, 2016, 'MIN, BOS'],
  ['Chase Utley', 2003, 2018, 'PHI, LAD'],
  ['Mike Trout', 2011, 2026, 'LAA'],
  ['Bobby Abreu', 1996, 2014, 'HOU, PHI, NYY, LAA, LAD, NYM'],
  ['Alex Rodriguez', 1994, 2016, 'SEA, TEX, NYY'],
  ['Alex Gordon', 2007, 2020, 'KCR'],
].map(([displayName, firstYear, lastYear, teamsDisplay], i) => ({
  playerId: 'ibp_' + (i + 1).toString(16).padStart(20, '0'),
  displayName, metadata: { firstYear, lastYear, teamsDisplay },
}));

async function reservePort() {
  const server = createServer();
  await new Promise((ok, no) => server.once('error', no).listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  await new Promise(ok => server.close(ok));
  return port;
}

function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
}

async function serveLocally(port) {
  const child = spawn('pnpm', [
    '--filter', '@initial-baseball/web', 'exec', 'next', 'dev',
    '--hostname', '127.0.0.1', '--port', String(port),
  ], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    // Minimal allowlist: do not inherit parent production tokens, database URLs,
    // signing keys, or provider identity just because QA runs in a configured shell.
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: process.env.LANG,
      TMPDIR: process.env.TMPDIR,
      NEXT_TELEMETRY_DISABLED: '1',
      CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED: 'true',
      CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED: 'true',
      VERCEL: '', VERCEL_ENV: '',
    },
  });
  let log = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { log = (log + chunk.toString()).slice(-3000); });
  }
  const url = 'http://127.0.0.1:' + port;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(url + '/create', { signal: AbortSignal.timeout(4000) });
      if (response.status === 200) return { child, url };
    } catch { /* Next is still compiling. */ }
    await delay(400);
  }
  stop(child);
  throw Error('Local Next.js did not start: ' + log);
}

function respond(route, data) {
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(data), headers: { 'cache-control': 'private, no-store' },
  });
}

async function choose(page, slot, player) {
  await page.getByRole('button', { name: 'Choose player for slot ' + slot, exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search player for slot ' + slot, exact: true })
    .fill(player.displayName);
  const item = page.locator('.custom-lineup-slot-search li button')
    .filter({ hasText: player.displayName }).first();
  await item.waitFor();
  const details = await item.innerText();
  assert.ok(details.includes(player.metadata.firstYear + '–' + player.metadata.lastYear));
  assert.ok(details.includes(player.metadata.teamsDisplay));
  await item.click();
}

async function run() {
  let server;
  let browser;
  let issued = 0;
  let attempted = 0;
  let rateLimitedOnce = false;
  const browserErrors = [];
  try {
    server = await serveLocally(await reservePort());
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    });
    page.on('pageerror', error => browserErrors.push(error.message));
    await page.route('**/api/players/search?*', route => {
      const q = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() ?? '';
      return respond(route, { results: candidates.filter(p => p.displayName.toLowerCase().includes(q)) });
    });
    await page.route('**/api/custom-lineup/create', route => {
      attempted++;
      const body = route.request().postDataJSON();
      assert.deepEqual(Object.keys(body).sort(), ['canonicalPlayerIds', 'title']);
      assert.equal(body.title, 'Browser QA ' + body.canonicalPlayerIds.length);
      assert.equal(new Set(body.canonicalPlayerIds).size, body.canonicalPlayerIds.length);
      const expected = candidates.slice(0, body.canonicalPlayerIds.length).map(p => p.playerId);
      if (expected.length > 1) {
        [expected[0], expected[expected.length - 1]] = [expected[expected.length - 1], expected[0]];
      }
      assert.deepEqual(body.canonicalPlayerIds, expected, 'Incorrect issued batting order');
      if (body.canonicalPlayerIds.length === 1 && !rateLimitedOnce) {
        rateLimitedOnce = true;
        return route.fulfill({
          status: 429, contentType: 'application/json',
          headers: { 'retry-after': '60', 'cache-control': 'private, no-store' },
          body: JSON.stringify({ error: 'creation_limit_reached' }),
        });
      }
      issued++;
      return route.fulfill({
        status: 201, contentType: 'application/json',
        headers: { 'cache-control': 'private, no-store' },
        body: JSON.stringify({ puzzleId, ownerCapability: ownerCode }),
      });
    });

    for (let n = 1; n <= 10; n++) {
      const response = await page.goto(server.url + '/create', { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      assert.equal(await page.locator('.custom-lineup-slots > li').count(), 9);
      assert.equal(await page.locator('#custom-lineup-length').inputValue(), '9');
      assert.equal(await page.getByRole('button', { name: 'Create challenge' }).isDisabled(), true);
      await page.locator('#custom-lineup-length').selectOption(String(n));
      await page.locator('#custom-lineup-puzzle-title').fill('Browser QA ' + n);
      if (n === 1) {
        const slot = page.getByRole('button', { name: 'Choose player for slot 1', exact: true });
        await slot.focus();
        await page.keyboard.press('Enter');
        await page.getByRole('searchbox', { name: 'Search player for slot 1', exact: true }).waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('searchbox', {
          name: 'Search player for slot 1', exact: true,
        }).count(), 0);
      }
      for (let i = 0; i < n; i++) {
        await choose(page, i + 1, candidates[i]);
        if (i === 0 && n > 1) {
          await page.getByRole('button', { name: 'Choose player for slot 2', exact: true }).click();
          await page.getByRole('searchbox', { name: 'Search player for slot 2', exact: true })
            .fill(candidates[0].displayName);
          const duplicate = page.locator('.custom-lineup-slot-search li button')
            .filter({ hasText: candidates[0].displayName }).first();
          await duplicate.waitFor();
          assert.equal(await duplicate.isDisabled(), true, 'Duplicate player not blocked');
          await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        }
      }
      if (n > 1) {
        await page.getByRole('button', { name: 'Swap ' + candidates[0].displayName + ' from slot 1' }).click();
        await page.getByRole('button', { name: 'Swap slot 1 with slot ' + n }).click();
        assert.ok((await page.locator('.custom-lineup-slots > li').first().innerText())
          .includes(candidates[n - 1].displayName));
      }
      assert.equal(await page.getByRole('button', { name: 'Create challenge' }).isEnabled(), true);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 844 });
        const size = await page.evaluate(() => ({
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert.ok(size.scroll <= size.client + 1,
          'Overflow at N=' + n + ', width=' + width + ': ' + JSON.stringify(size));
      }
      if (n === 1) {
        await page.getByRole('button', { name: 'Create challenge' }).click();
        const limitError = page.locator('.custom-nine-create-action [role="alert"]');
        await limitError.waitFor();
        assert.match(await limitError.innerText(), /creation limit/i);
        assert.equal(await page.getByRole('button', { name: 'Create challenge' }).isEnabled(), true);
        assert.equal(await page.getByText('Challenge issued.').count(), 0);
        assert.equal(await page.getByText(ownerCode, { exact: true }).count(), 0);
        assert.ok((await page.locator('.custom-lineup-slots > li').first().innerText())
          .includes(candidates[0].displayName), 'Rate limit erased the creator draft');
      }
      await page.getByRole('button', { name: 'Create challenge' }).click();
      await page.getByText('Challenge issued.').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Create challenge' }).isDisabled(), true);
      const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
      assert.ok(links.some(h => h?.includes('/custom/' + puzzleId)), 'Friend URL missing');
      assert.ok(links.every(h => !h?.includes(ownerCode)), 'Owner code leaked in friend URL');
      assert.ok(await page.getByText(ownerCode, { exact: true }).count(), 'Owner code not displayed separately');
      const shareUrl = await page.locator('#custom-lineup-share-url').inputValue();
      assert.equal(new URL(shareUrl).pathname, '/custom/' + puzzleId);
      assert.ok(!shareUrl.includes(ownerCode), 'Private owner code leaked into friend share input');
      for (const width of widths) {
        await page.setViewportSize({ width, height: 844 });
        const size = await page.evaluate(() => ({
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert.ok(size.scroll <= size.client + 1,
          'Post-issuance overflow at N=' + n + ', width=' + width + ': ' + JSON.stringify(size));
      }
      console.log('PASS ' + n + ' slots: pre/post-issue six-width layout, search, swap and owner isolation');
    }
    assert.equal(issued, 10);
    assert.equal(attempted, 11, '429 should permit an exact retry without losing the draft');
    assert.equal(rateLimitedOnce, true);
    assert.deepEqual(browserErrors, []);
    console.log('PASS all 1–10 with 429 recovery and post-issuance layout: local mocked browser acceptance only');
  } finally {
    if (browser) await browser.close();
    if (server) stop(server.child);
  }
}
await run();
