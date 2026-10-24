import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyNativeBrowserContinuity, assertSameSignedProgression }
  from './qa-custom-v2-native-browser.mjs';

const noFixtures = () => { throw new Error('Preflight must precede fixtures'); };
for (const url of ['https://initial-baseball-web.vercel.app/',
  'https://iklbnlicgsxxhaoiscor.supabase.co/',
  'http://localhost.evil.invalid:3000/', 'http://127.0.0.2:3000/']) {
  test('refuse non-loopback browser integration origin: ' + url, async () => {
    await assert.rejects(verifyNativeBrowserContinuity({
      base: new URL(url), createChallenge: noFixtures, players: [],
      modulePath: '/qa/playwright/index.mjs',
    }), /loopback|local Next/);
  });
}
test('refuse non-absolute Playwright path before fixture access', async () => {
  await assert.rejects(verifyNativeBrowserContinuity({
    base: new URL('http://127.0.0.1:3000/'), createChallenge: noFixtures,
    players: [], modulePath: 'playwright/index.mjs',
  }), /QA-only Playwright module/);
});

test('accept localhost loopback before module preflight', async () => {
  await assert.rejects(verifyNativeBrowserContinuity({
    base: new URL('http://localhost:3000/'), createChallenge: noFixtures,
    players: [], modulePath: 'playwright/index.mjs',
  }), /QA-only Playwright module/);
});

// Preflight child processes use fictitious credentials and cannot reach a server.
// The absence of a configured public-creator mode must never silently skip the
// requested real-browser acceptance run and report only HTTP suite success.
const qaScript = fileURLToPath(new URL('./qa-custom-v2-hosted.mjs', import.meta.url));
for (const [mode, modulePath, expected] of [
  ['false', '/qa/playwright/index.mjs', /requires CUSTOM_V2_QA_PUBLIC_CREATION=true/],
  ['true', '', /requires a nonempty Playwright module path/],
]) {
  test('requested native QA fails before fixtures with invalid flags: ' + mode,
    () => {
      const child = spawnSync(process.execPath, [qaScript], {
        encoding: 'utf8', timeout: 5000,
        env: {
          CUSTOM_V2_QA_PROJECT_REF: 'iklbnlicgsxxhaoiscor',
          SUPABASE_URL: 'https://iklbnlicgsxxhaoiscor.supabase.co/',
          SUPABASE_SERVICE_ROLE_KEY: 'qa-fictitious-never-contact-server',
          DAILY_PROGRESSION_SECRET: 'x'.repeat(32),
          CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED: 'true',
          CUSTOM_V2_QA_PUBLIC_CREATION: mode,
          CUSTOM_V2_QA_PLAYWRIGHT_MODULE: modulePath,
        },
      });
      assert.equal(child.error, undefined);
      assert.equal(child.signal, null);
      assert.notEqual(child.status, 0);
      assert.match(child.stderr, expected);
    });
}

// A failure must never print signed progression tokens (or hint/player payloads)
// in public CI diagnostics; assert.equal(actual, expected) would leak both.
test('signed progression assertion redacts mismatched credentials', () => {
  const secretA = 'qa-token-A-signature-restricted-1234';
  const secretB = 'qa-token-B-signature-restricted-5678';
  assert.doesNotThrow(() => assertSameSignedProgression(secretA, secretA, 'same attempt'));
  assert.throws(() => assertSameSignedProgression(secretA, secretB, 'attempt mismatch'),
    error => {
      assert.equal(error.name, 'AssertionError');
      const rendered = String(error.stack) + JSON.stringify(error);
      assert.ok(!rendered.includes(secretA));
      assert.ok(!rendered.includes(secretB));
      assert.match(rendered, /attempt mismatch/);
      return true;
    });
});
