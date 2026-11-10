import assert from 'node:assert/strict';
import test from 'node:test';
import { createIsolationBrowserEnvironment, isIsolationFixtureRequestAllowed } from './qa-official-daily-isolation-safety.mjs';

test('fixture browser accepts only its exact ephemeral IPv4 loopback origin', () => {
  const origin = 'http://127.0.0.1:34123';
  assert.equal(isIsolationFixtureRequestAllowed(origin + '/?edition=1', origin), true);
  assert.equal(isIsolationFixtureRequestAllowed(origin + '/fixture.js', origin), true);
  for (const request of ['https://example.com/', 'http://localhost:34123/',
    'http://127.0.0.1:34124/', 'https://127.0.0.1:34123/', 'not-a-url']) {
    assert.equal(isIsolationFixtureRequestAllowed(request, origin), false);
  }
  for (const invalid of ['http://localhost:34123', 'http://127.0.0.1',
    origin + '/', 'http://user:secret@127.0.0.1:34123', 'https://example.com']) {
    assert.equal(isIsolationFixtureRequestAllowed(invalid, invalid), false);
  }
});

test('browser environment drops inherited database, auth, CI and runtime secrets', () => {
  const environment = createIsolationBrowserEnvironment({ PATH: '/bin', HOME: '/tmp/home',
    LANG: 'C.UTF-8', TMPDIR: '/tmp/qa', SUPABASE_SERVICE_ROLE_KEY: 'must-not-inherit',
    GITHUB_TOKEN: 'must-not-inherit', NODE_OPTIONS: '--require=untrusted',
    DAILY_PROGRESSION_SECRET: 'must-not-inherit', CREATOR_AUTH_ENABLED: 'true' });
  assert.deepEqual(environment, { PATH: '/bin', HOME: '/tmp/home', LANG: 'C.UTF-8', TMPDIR: '/tmp/qa' });
  assert.deepEqual(createIsolationBrowserEnvironment({}), {
    PATH: '/usr/bin:/bin', HOME: '/tmp', LANG: 'C.UTF-8', TMPDIR: '/tmp',
  });
});
