import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertNoImplicitNextEnvironmentFiles, createDefaultOffSmokeEnvironment } from './qa-default-off-browser-safety.mjs';

test('native smoke child receives no production or hosted QA credentials', () => {
  const environment = createDefaultOffSmokeEnvironment({
    PATH: '/bin', HOME: '/tmp', LANG: 'C',
    SUPABASE_URL: 'https://production.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'SENSITIVE',
    SUPABASE_PUBLISHABLE_KEY: 'SENSITIVE',
    GITHUB_TOKEN: 'SENSITIVE',
    VERCEL: '1',
    VERCEL_ENV: 'production',
    DAILY_PROGRESSION_SECRET: 'SENSITIVE',
    CREATOR_AUTH_ENABLED: 'true',
    CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED: 'true',
    CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED: 'true',
    CUSTOM_V2_COMPLETION_DISPLAY_ENABLED: 'true',
    CUSTOM_LINEUP_VARIABLE_STRIKES_ENABLED: 'true',
    CLASSIC_INNING_ENABLED: 'true',
  }, 47651);
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY', 'GITHUB_TOKEN', 'VERCEL', 'VERCEL_ENV']) {
    assert.equal(Object.hasOwn(environment, key), false, key + ' must not be forwarded');
  }
  assert.equal(environment.DAILY_PROGRESSION_SECRET.includes('SENSITIVE'), false);
  assert.equal(environment.DAILY_PROGRESSION_SECRET,
    'ci-only-daily-progression-secret-0123456789abcdef',
    'Build-time prerendered Daily tokens and runtime hint API must use the same isolated test key');
  assert.equal(environment.HOSTNAME, '127.0.0.1');
  assert.equal(environment.PORT, '47651');
  assert.equal(environment.NODE_ENV, 'production');
  for (const flag of ['CREATOR_AUTH_ENABLED', 'CLASSIC_INNING_ENABLED',
    'CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED',
    'CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED',
    'CUSTOM_V2_COMPLETION_DISPLAY_ENABLED',
    'CUSTOM_LINEUP_VARIABLE_STRIKES_ENABLED']) {
    assert.equal(environment[flag], 'false', flag + ' must remain OFF');
  }
});

test('refuses unbounded or invalid port values', () => {
  for (const port of [0, -1, 65536, 2.5, NaN, '3000']) {
    assert.throws(() => createDefaultOffSmokeEnvironment({}, port), /loopback port/);
  }
});

test('refuses locally loaded Next env files, but allows harmless example templates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ib-no-env-'));
  try {
    await writeFile(join(root, '.env.example'), 'SUPABASE_URL=placeholder');
    await assert.doesNotReject(assertNoImplicitNextEnvironmentFiles(root));
    for (const name of ['.env', '.env.local', '.env.production', '.env.production.local',
      '.ENV', '.Env.Local', '.ENV.PRODUCTION.LOCAL']) {
      await writeFile(join(root, name), 'SUPABASE_URL=SENSITIVE');
      await assert.rejects(assertNoImplicitNextEnvironmentFiles(root), /refuses local Next environment file/);
      await rm(join(root, name));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
