#!/usr/bin/env node
/** Actual React component + transport in Chromium; simulated loopback HTTP only. */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { puzzleId, serveCompletionDisplayFixture } from './qa-custom-completion-display-fixture.mjs';

const modulePath = process.env.CUSTOM_DISPLAY_QA_PLAYWRIGHT_MODULE;
assert.ok(modulePath && isAbsolute(modulePath) && modulePath.endsWith('/playwright/index.mjs'),
  'Set CUSTOM_DISPLAY_QA_PLAYWRIGHT_MODULE to an external QA-only playwright/index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
const web = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(join(web, 'package.json'));
const { build } = createRequire(createRequire(require.resolve('vitest/package.json'))
  .resolve('vite/package.json'))('esbuild');
const temporary = await mkdtemp(join(tmpdir(), 'ib-display-qa-'));
let browser;
try {
  const entry = join(temporary, 'entry.tsx');
  await writeFile(entry, [
    `import React from ${JSON.stringify(require.resolve('react'))};`,
    `import { createRoot } from ${JSON.stringify(require.resolve('react-dom/client'))};`,
    `import { CustomLineupCompletionDisplay } from ${JSON.stringify(join(web, 'app/custom/CustomLineupCompletionDisplay.tsx'))};`,
    `createRoot(document.getElementById('root')!).render(<CustomLineupCompletionDisplay puzzleId=${JSON.stringify(puzzleId)} />);`,
  ].join('\n'));
  const built = await build({ entryPoints: [entry], bundle: true, write: false,
    format: 'iife', platform: 'browser', jsx: 'transform',
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: { '@initial-baseball/shared': join(root, 'packages/shared/src/index.ts') } });
  const executablePath = process.env.CUSTOM_DISPLAY_QA_CHROMIUM_EXECUTABLE;
  assert.ok(!executablePath || isAbsolute(executablePath), 'Chromium executable must be absolute');
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    for (const scenario of ['named', 'anonymous', 'existing', 'lost-post', 'invalid',
      'load-retry', 'write-retry']) {
      await run(scenario, viewport, built.outputFiles[0].text);
    }
  }
  console.log('PASS 14 Custom completion display Chromium scenarios; simulated HTTP only.');
} finally {
  await browser?.close();
  await rm(temporary, { recursive: true, force: true });
}

async function run(scenario, viewport, bundle) {
  const label = scenario + ' at ' + viewport.width + 'px';
  const options = scenario === 'existing'
    ? { winner: { mode: 'anonymous', displayName: null } }
    : scenario === 'lost-post' ? { losePostResponse: true }
      : scenario === 'load-retry' ? { failReadOnce: true }
        : scenario === 'write-retry' ? { postFailure: true } : {};
  const fixture = await serveCompletionDisplayFixture(bundle, options);
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  context.setDefaultTimeout(10_000);
  context.setDefaultNavigationTimeout(15_000);
  const errors = [];
  try {
    await context.route('**/*', route => new URL(route.request().url()).origin === fixture.url
      ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', () => errors.push('Uncaught browser error'));
    await page.goto(fixture.url);
    const input = page.getByLabel('Display name (optional)');
    if (scenario === 'load-retry') {
      await page.getByRole('alert').filter({ hasText: 'Could not load your saved choice' }).waitFor();
      assert.equal(fixture.writes.length, 0);
      await page.getByRole('button', { name: 'Retry loading' }).click();
    }
    await input.waitFor();
    if (scenario === 'invalid') {
      await input.fill('   ');
      await page.getByRole('button', { name: 'Save name', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Enter a name of 1–32 characters.' }).waitFor();
      assert.equal(fixture.writes.length, 0, 'Invalid input must not reach HTTP');
      await input.fill('A'.repeat(33));
      assert.equal((await input.inputValue()).length, 32, 'Native input enforces 32 UTF-16 units');
      assert.equal(fixture.writes.length, 0);
      return;
    }
    const anonymous = scenario === 'anonymous';
    // Plain-text HTML-like input must survive as text, without creating an element.
    const name = '<img src=x onerror=alert(1)>';
    if (anonymous) await page.getByRole('button', { name: 'Stay Anonymous' }).click();
    else {
      await input.fill('  ' + name + '  ');
      await page.getByRole('button', { name: 'Save name', exact: true }).click();
    }
    if (scenario === 'write-retry') {
      await page.getByRole('alert').filter({ hasText: 'Your choice could not be saved' }).waitFor();
      assert.equal(await input.inputValue(), '  ' + name + '  ');
      assert.equal(fixture.writes.length, 1);
      assert.ok(fixture.reads.length >= 2, 'Failed POST requires authoritative readback');
      assert.equal(await page.getByText('Name saved:', { exact: false }).count(), 0);
      return;
    }
    const expected = anonymous || scenario === 'existing' ? 'Saved as Anonymous.' : 'Name saved: ' + name + '.';
    await page.getByRole('status').filter({ hasText: expected }).waitFor();
    assert.equal(await input.count(), 0, 'A saved first choice is not editable');
    assert.equal(await page.locator('img').count(), 0, 'Names render only as escaped text');
    // Chromium can retransmit a POST when a reused socket closes before any
    // response headers arrive. Model that actual delivery behavior explicitly:
    // every retransmission must carry the same choice and preserve first-write
    // authority. Other scenarios still require exactly one HTTP write.
    const settledWrites = fixture.writes.length;
    if (scenario === 'lost-post') assert.ok(settledWrites >= 1, label + ': a write must reach the fixture');
    else assert.equal(settledWrites, 1, label + ': one choice write expected');
    for (const choice of fixture.writes) {
      assert.deepEqual(choice, anonymous
        ? { mode: 'anonymous' } : { mode: 'named', displayName: name },
      label + ': retries must preserve the exact choice');
    }
    if (scenario === 'existing' || scenario === 'lost-post') {
      assert.ok(fixture.reads.length >= 2, label + ': existing or lost write requires authoritative readback');
    }
    await page.reload();
    await page.getByRole('status').filter({ hasText: expected }).waitFor();
    assert.equal(await input.count(), 0);
    assert.equal(fixture.writes.length, settledWrites,
      label + ': reload reads the first choice without another write');
  } finally {
    await context.close();
    await fixture.close();
    assert.equal(errors.length, 0, label + ': no uncaught React/browser error');
    assert.equal(fixture.failures.length, 0, label + ': simulated HTTP contract remains valid');
  }
}
