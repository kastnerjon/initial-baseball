/**
 * Optional QA-only native Chromium acceptance against a real, isolated-DB Next server.
 * Invoked solely by qa-custom-v2-hosted.mjs after its hard-pinned QA preflight.
 * Neither HTTP nor database responses are mocked or intercepted here.
 */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const puzzleIdPattern = /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function verifyNativeBrowserContinuity({ base, createChallenge, players, modulePath }) {
  assert.equal(base.hostname, '127.0.0.1', 'Native QA must stay on loopback');
  assert.equal(base.protocol, 'http:', 'Native QA must use the local Next server');
  assert.ok(isAbsolute(modulePath) && modulePath.endsWith('/playwright/index.mjs'),
    'Use an explicitly installed, QA-only Playwright module');
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const require = createRequire(join(webRoot, 'package.json'));
  const { build } = createRequire(createRequire(require.resolve('vitest/package.json'))
    .resolve('vite/package.json'))('esbuild');
  const temp = await mkdtemp(join(tmpdir(), 'ib-real-bootstrap-'));
  let browser;
  try {
    const entry = join(temp, 'entry.ts');
    await writeFile(entry,
      `export { createCustomLineupV2BrowserTransport } from ${JSON.stringify(join(webRoot, 'app/customLineupV2BrowserTransport.ts'))};\n`);
    const output = await build({ entryPoints: [entry], bundle: true, write: false,
      format: 'iife', globalName: 'IBNativeCustomQA', platform: 'browser',
      alias: { '@initial-baseball/engine': join(repoRoot, 'packages/engine/src/index.ts'),
        '@initial-baseball/shared': join(repoRoot, 'packages/shared/src/index.ts') } });
    const executablePath = process.env.CUSTOM_V2_QA_CHROMIUM_EXECUTABLE;
    assert.ok(!executablePath || isAbsolute(executablePath),
      'QA Chromium executable must be an absolute path');
    browser = await chromium.launch({ headless: true,
      ...(executablePath ? { executablePath } : {}) });
    for (const n of [1, 10]) {
      const id = await createChallenge(n);
      assert.match(id, puzzleIdPattern);
      const context = await browser.newContext();
      try {
        const a = await context.newPage();
        const b = await context.newPage();
        await Promise.all([a.goto(base.href), b.goto(base.href)]);
        await Promise.all([a.addScriptTag({ content: output.outputFiles[0].text }),
          b.addScriptTag({ content: output.outputFiles[0].text })]);
        // Two real browser tabs share native Web Locks and HttpOnly cookies.
        // Both POSTs reach the real Next handler and isolated Supabase ledger.
        const [first, second] = await Promise.all([a, b].map(page => page.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id)));
        assert.equal(first.attemptMode, 'reserved');
        assert.equal(second.attemptMode, 'reserved');
        assert.equal(first.atBats.length, n);
        assert.deepEqual(second.atBats, first.atBats);
        assert.equal(second.progressionToken, first.progressionToken,
          'Concurrent same-browser first opens must resume one signed attempt');
        // Advance one actual signed attempt through the same transported browser API.
        const hinted = await b.evaluate(async ({ puzzleId, token }) =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().revealHint(puzzleId, token),
        { puzzleId: id, token: second.progressionToken });
        const restored = await a.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id);
        assert.equal(restored.attemptMode, 'reserved');
        assert.equal(restored.hintBundle.revealedCount, 1);
        assert.equal(restored.progressionToken, hinted.progressionToken,
          'Other tab must recover progressed token, not initialize a new attempt');
        let token = restored.progressionToken;
        for (let pitch = 1; pitch <= n; pitch++) {
          const resolved = await b.evaluate(async ({ puzzleId, progressionToken, currentPitch,
            totalAtBats, playerId }) => window.IBNativeCustomQA.createCustomLineupV2BrowserTransport()
            .resolve(puzzleId, progressionToken, currentPitch, totalAtBats,
              { submittedPlayerId: playerId }),
          { puzzleId: id, progressionToken: token, currentPitch: pitch, totalAtBats: n,
            playerId: players[pitch - 1] });
          assert.equal(resolved.kind, 'terminal');
          assert.equal(resolved.completed, pitch === n);
          token = resolved.progressionToken;
        }
        const finished = await a.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id);
        assert.equal(finished.attemptMode, 'completed');
        assert.equal(finished.completedAtBats.length, n);
        assert.equal('progressionToken' in finished, false);
        const submit = await b.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().submit(puzzleId), id);
        assert.equal(submit, 'created');
        await a.reload();
        await a.addScriptTag({ content: output.outputFiles[0].text });
        const persisted = await a.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id);
        assert.equal(persisted.attemptMode, 'completed');
        assert.equal(persisted.completedAtBats.length, n);
        console.log('PASS actual Chromium + isolated Supabase signed cross-tab continuity N=' + n);
      } finally {
        await context.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    await rm(temp, { force: true, recursive: true });
  }
}
