/**
 * Optional QA-only native Chromium acceptance against a real, isolated-DB Next server.
 * Invoked solely by qa-custom-v2-hosted.mjs after its hard-pinned QA preflight.
 * One case forwards a real resolve request, confirms the server response, then
 * aborts delivery to the browser to model a lost response after server commit.
 */
import { randomInt } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const puzzleIdPattern = /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Assert on a boolean, not on secret string operands. node:assert.equal embeds
// actual/expected signed credentials in its failure diff and CI job logs.
export function assertSameSignedProgression(actual, expected, message) {
  assert.ok(actual === expected, message);
}

async function verifyNativeCreatorResponseLoss(browser, base, players) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    // Keep this case focused on issuance UX while using a known QA-valid player.
    // The actual creation POST, feature gate, quota, issuance and owner code are real.
    await page.route('**/api/players/search*', route => route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        results: [{ playerId: players[0], displayName: 'QA Fixture Player' }],
      }),
    }));
    await page.goto(new URL('/create', base).href);

    const title = 'QA native creator response loss';
    await page.getByLabel('Puzzle name (3–60 characters)').fill(title);
    await page.getByLabel('Number of players').selectOption('1');
    await page.getByRole('button', { name: 'Choose player for slot 1' }).click();
    await page.getByRole('searchbox', { name: 'Search player for slot 1' }).fill('QA');
    const candidate = page.getByRole('button', { name: /QA Fixture Player/ });
    await candidate.waitFor({ state: 'visible', timeout: 15_000 });
    await candidate.click();
    assert.equal(await page.locator('button[aria-label="Change player in slot 1"]').textContent(),
      'QA Fixture Player', 'The real creator UI must retain the selected QA player');

    const createUrl = new URL('/api/custom-lineup/create', base).href;
    const qaIp = '192.0.2.' + randomInt(1, 255);
    let requestCount = 0;
    let serverStatus = null;
    let firstPuzzleId = null;
    let firstOwnerCapability = null;
    await page.route(createUrl, async route => {
      requestCount++;
      const response = await route.fetch();
      if (requestCount === 1) {
        serverStatus = response.status();
        if (serverStatus === 201) {
          const firstPayload = await response.json();
          firstPuzzleId = typeof firstPayload?.puzzleId === 'string'
            ? firstPayload.puzzleId : null;
          firstOwnerCapability = typeof firstPayload?.ownerCapability === 'string'
            ? firstPayload.ownerCapability : null;
        }
        await route.abort('internetdisconnected');
        return;
      }
      await route.fulfill({ response });
    });

    const createButton = page.getByRole('button', { name: 'Create challenge', exact: true });
    await createButton.click();
    const alert = page.getByRole('alert');
    await alert.waitFor({ state: 'visible', timeout: 15_000 });
    const errorText = await alert.textContent();
    assert.equal(errorText,
      'Could not confirm whether your lineup was created. If it was, its owner code cannot be recovered here. Retrying creates a separate challenge and uses another creation attempt.',
      'The actual creator UI must explain that the first owner code is not recoverable');
    assert.equal(serverStatus, 201,
      'The isolated Next/Supabase handler must finish issuance before delivery is dropped');
    assert.ok(puzzleIdPattern.test(firstPuzzleId ?? ''),
      'The intercepted server response must contain a newly issued QA challenge');
    assert.ok(typeof firstOwnerCapability === 'string'
      && /^[A-Za-z0-9_-]{43}$/.test(firstOwnerCapability),
    'The committed issuance must contain a well-formed one-time owner capability');
    assert.equal(requestCount, 1,
      'The real creator UI must not issue an automatic duplicate after a lost response');
    assert.ok(await createButton.isEnabled(),
      'The creator must allow a separate user-requested retry after explaining uncertainty');
    assert.equal(await page.getByLabel('Puzzle name (3–60 characters)').inputValue(), title,
      'The failed create must preserve the title for an explicit retry');
    assert.equal(await page.locator('button[aria-label="Change player in slot 1"]').textContent(),
      'QA Fixture Player', 'The failed create must preserve the selected player');

    await createButton.click();
    await page.getByText('Challenge issued.', { exact: true })
      .waitFor({ state: 'visible', timeout: 15_000 });
    assert.equal(requestCount, 2,
      'The second issuance must follow one explicit click after the lost response');
    const shareHref = await page.getByLabel('Challenge link').inputValue();
    const retryPuzzleId = new URL(shareHref, base).pathname.split('/').at(-1) ?? '';
    const retryOwnerCapability = (await page.locator('.custom-nine-created code').last()
      .textContent())?.trim() ?? '';
    assert.ok(puzzleIdPattern.test(retryPuzzleId),
      'The explicit retry must return a distinct private challenge link');
    assert.ok(/^[A-Za-z0-9_-]{43}$/.test(retryOwnerCapability),
      'The real creator UI must display the new one-time owner capability');
    assert.ok(retryPuzzleId !== firstPuzzleId,
      'Manual retry must create a separate immutable private challenge');
    assert.ok(retryOwnerCapability !== firstOwnerCapability,
      'A separate issuance must use a different private owner capability');
    firstOwnerCapability = null;
    console.log('PASS actual Chromium /create UI response loss and explicit retry on isolated QA');
  } finally {
    await context.close();
  }
}

export async function verifyNativeBrowserContinuity({ base, createChallenge, players, modulePath }) {
  assert.ok(base.hostname === '127.0.0.1' || base.hostname === 'localhost',
    'Native QA must stay on loopback');
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
    await verifyNativeCreatorResponseLoss(browser, base, players);
    for (const n of [1, 10]) {
      const id = await createChallenge(n);
      assert.ok(puzzleIdPattern.test(id), 'Expected a newly issued isolated-QA puzzle ID');
      const context = await browser.newContext();
      try {
        const a = await context.newPage();
        const b = await context.newPage();
        const challengeUrl = new URL('/custom/' + id, base).href;
        await Promise.all([a.goto(base.href), b.goto(base.href)]);
        await Promise.all([a.addScriptTag({ content: output.outputFiles[0].text }),
          b.addScriptTag({ content: output.outputFiles[0].text })]);
        const expectedCookie = 'ib-custom-lineup-v2-attempt-' + id + '=';
        const bootstrapCookiePresence = [];
        const bootstrapRequestListeners = new Map();
        for (const tab of [a, b]) {
          const onBootstrapRequest = request => {
            if (request.method() !== 'POST'
              || new URL(request.url()).pathname !== '/api/custom-lineup/challenges/'
                + id + '/attempt/bootstrap') return;
            // Keep only a boolean, never a credential value, in test evidence.
            bootstrapCookiePresence.push(request.allHeaders().then(headers =>
              (headers.cookie ?? '').split(';').some(pair =>
                pair.trim().startsWith(expectedCookie))));
          };
          bootstrapRequestListeners.set(tab, onBootstrapRequest);
          tab.on('request', onBootstrapRequest);
        }
        // Start two first opens together in the same real browser context.
        let first;
        let second;
        let cookieHeaderReads;
        try {
          [first, second] = await Promise.all([a, b].map(page => page.evaluate(async puzzleId =>
            window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id)));
        } finally {
          for (const [tab, listener] of bootstrapRequestListeners) tab.off('request', listener);
          cookieHeaderReads = await Promise.allSettled(bootstrapCookiePresence);
        }
        assert.equal(first.attemptMode, 'reserved');
        assert.equal(second.attemptMode, 'reserved');
        assert.equal(first.atBats.length, n);
        assert.ok(JSON.stringify(second.atBats) === JSON.stringify(first.atBats),
          'Concurrent tabs must receive the identical spoiler-safe public slots');
        assertSameSignedProgression(second.progressionToken, first.progressionToken,
          'Concurrent same-browser first opens must resume one signed attempt');
        assert.equal(bootstrapCookiePresence.length, 2, 'Exactly two browser bootstrap POSTs');
        assert.ok(cookieHeaderReads.every(result => result.status === 'fulfilled'),
          'Reading initial bootstrap request headers must succeed');
        assert.deepEqual(cookieHeaderReads.map(result => result.status === 'fulfilled'
          ? result.value : false).sort(), [false, true],
          'One first request must lack this challenge cookie; the second must reuse it');
        // Advance one actual signed attempt through the same transported browser API.
        const hinted = await b.evaluate(async ({ puzzleId, token }) =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().revealHint(puzzleId, token),
        { puzzleId: id, token: second.progressionToken });
        const restored = await a.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id);
        assert.equal(restored.attemptMode, 'reserved');
        assert.equal(restored.hintBundle.revealedCount, 1);
        assertSameSignedProgression(restored.progressionToken, hinted.progressionToken,
          'Other tab must recover progressed token, not initialize a new attempt');
        let token = restored.progressionToken;
        let firstPitch = 1;
        let playPage = a;
        if (n === 10) {
          // Let the signed server/database commit the correct first pitch, then
          // drop its HTTP response at the browser boundary. A refresh must recover
          // the committed pitch and current signed state instead of resetting it.
          const resolvePattern = '**/api/custom-lineup/challenges/' + id + '/attempt/resolve';
          let serverResponseStatus = null;
          await a.route(resolvePattern, async route => {
            const response = await route.fetch();
            serverResponseStatus = response.status();
            await route.abort('internetdisconnected');
          });
          let responseWasLost = false;
          try {
            await a.evaluate(async ({ puzzleId, progressionToken, playerId }) =>
              window.IBNativeCustomQA.createCustomLineupV2BrowserTransport()
                .resolve(puzzleId, progressionToken, 1, 10, { submittedPlayerId: playerId }),
            { puzzleId: id, progressionToken: token, playerId: players[0] });
          } catch {
            responseWasLost = true;
          } finally {
            await a.unroute(resolvePattern);
          }
          assert.ok(responseWasLost, 'Browser must observe the deliberately interrupted response');
          assert.equal(serverResponseStatus, 200,
            'The isolated Next/Supabase server must commit before the response is dropped');

          // Navigate into the real app route, then refresh it. The mounted UI
          // must render the next pitch from the committed server state.
          await a.goto(challengeUrl);
          await a.getByText('At bat 2 of 10', { exact: true })
            .waitFor({ state: 'visible', timeout: 15_000 });
          await a.reload();
          await a.getByText('At bat 2 of 10', { exact: true })
            .waitFor({ state: 'visible', timeout: 15_000 });
          await a.addScriptTag({ content: output.outputFiles[0].text });
          const afterRefresh = await a.evaluate(async puzzleId =>
            window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id);
          assert.equal(afterRefresh.attemptMode, 'reserved');
          assert.equal(afterRefresh.attemptProgress.completedAtBats.length, 1,
            'Refresh must preserve the server-committed first pitch');
          assert.equal(afterRefresh.hintBundle.pitchNumber, 2,
            'Refresh must resume at the next pitch after the lost response');

          // Leave the game route, return to it, then close and reopen in a new tab.
          await a.goto(new URL('/archive', base).href);
          await a.goto(challengeUrl);
          await a.getByText('At bat 2 of 10', { exact: true })
            .waitFor({ state: 'visible', timeout: 15_000 });
          await a.addScriptTag({ content: output.outputFiles[0].text });
          const afterNavigation = await a.evaluate(async puzzleId =>
            window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id);
          assert.equal(afterNavigation.attemptProgress.completedAtBats.length, 1,
            'Navigating away and back must preserve the committed pitch');
          assertSameSignedProgression(afterNavigation.progressionToken,
            afterRefresh.progressionToken,
            'Navigation must restore the current signed attempt, not a second attempt');
          await a.close();
          const reopened = await context.newPage();
          await reopened.goto(challengeUrl);
          await reopened.getByText('At bat 2 of 10', { exact: true })
            .waitFor({ state: 'visible', timeout: 15_000 });
          await reopened.addScriptTag({ content: output.outputFiles[0].text });
          const afterReopen = await reopened.evaluate(async puzzleId =>
            window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id);
          assert.equal(afterReopen.attemptProgress.completedAtBats.length, 1,
            'Reopening the same challenge must keep the previously recorded pitch');
          assertSameSignedProgression(afterReopen.progressionToken,
            afterRefresh.progressionToken,
            'Reopening must resume the same signed attempt');
          token = afterReopen.progressionToken;
          firstPitch = 2;
          playPage = reopened;
        }
        for (let pitch = firstPitch; pitch <= n; pitch++) {
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
        const finished = await playPage.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id);
        assert.equal(finished.attemptMode, 'completed');
        assert.equal(finished.completedAtBats.length, n);
        assert.equal('progressionToken' in finished, false);
        const submit = await b.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().submit(puzzleId), id);
        assert.equal(submit, 'created');
        const duplicateSubmit = await playPage.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().submit(puzzleId), id);
        assert.equal(duplicateSubmit, 'existing', 'A second browser must not admit another result');
        if (n === 1) await playPage.goto(challengeUrl);
        else await playPage.reload();
        await playPage.getByText('Lineup complete', { exact: true })
          .waitFor({ state: 'visible', timeout: 15_000 });
        await playPage.addScriptTag({ content: output.outputFiles[0].text });
        const persisted = await playPage.evaluate(async puzzleId =>
          window.IBNativeCustomQA.createCustomLineupV2BrowserTransport().bootstrap(puzzleId), id);
        assert.equal(persisted.attemptMode, 'completed');
        assert.equal(persisted.completedAtBats.length, n);
        console.log('PASS actual Chromium UI + isolated Supabase signed continuity N=' + n);
      } finally {
        await context.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    await rm(temp, { force: true, recursive: true });
  }
}
