import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyNativeBrowserContinuity } from './qa-custom-v2-native-browser.mjs';

const noFixtures = () => { throw new Error('Preflight must precede fixtures'); };
for (const url of ['https://initial-baseball-web.vercel.app/',
  'https://iklbnlicgsxxhaoiscor.supabase.co/', 'http://localhost:3000/']) {
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
