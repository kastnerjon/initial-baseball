import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./qa-custom-v2-hosted.mjs', import.meta.url));
const qaRef = 'iklbnlicgsxxhaoiscor';
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  CUSTOM_V2_QA_PROJECT_REF: qaRef,
  SUPABASE_URL: 'https://' + qaRef + '.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'not-a-real-staging-secret',
  DAILY_PROGRESSION_SECRET: 'qa-test-secret-is-at-least-thirty-two-characters',
  DAILY_ADMIN_USERNAME: 'staging-qa',
  DAILY_ADMIN_PASSWORD: 'qa-password',
  CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED: 'true',
  CUSTOM_V2_QA_PLAYER_IDS: 'invalid-fixture-on-purpose',
};

function expectGuard(overrides, rejection) {
  const run = spawnSync(process.execPath, [script], {
    env: { ...env, ...overrides },
    encoding: 'utf8', timeout: 5000,
  });
  assert.notEqual(run.status, 0, 'Guard must fail before any Next server is launched');
  assert.equal(run.error, undefined);
  assert.match(run.stderr, rejection);
}

describe('Custom v2 isolated hosted QA startup guard (never connects to a database)', () => {
  it('rejects absent project ref and hard-pinned production ref', () => {
    expectGuard({ CUSTOM_V2_QA_PROJECT_REF: '' }, /CUSTOM_V2_QA_PROJECT_REF/);
    expectGuard({ CUSTOM_V2_QA_PROJECT_REF: 'dwreeiydvwikpamlokji' },
      /Production Supabase is prohibited/);
  });

  it('requires the exact nonproduction HTTPS project origin', () => {
    expectGuard({ SUPABASE_URL: 'http://' + qaRef + '.supabase.co' },
      /exact HTTPS URL/);
    expectGuard({ SUPABASE_URL: 'https://otherproject0000000.supabase.co' },
      /exact HTTPS URL/);
    expectGuard({ SUPABASE_URL: env.SUPABASE_URL + '/rest/v1' },
      /exact HTTPS URL/);
    expectGuard({ SUPABASE_URL: env.SUPABASE_URL + '?foo=bar' },
      /exact HTTPS URL/);
  });

  it('requires signing secret, private DB credential and opt-in game flag', () => {
    expectGuard({ SUPABASE_SERVICE_ROLE_KEY: '' }, /SUPABASE_SERVICE_ROLE_KEY/);
    expectGuard({ DAILY_PROGRESSION_SECRET: 'short' }, /isolated staging signing secret/);
    expectGuard({ CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED: 'false' },
      /Only local staging gameplay may be enabled/);
  });

  it('requires explicit nonproduction settings before simulated public creator QA', () => {
    const approved = {
      CUSTOM_V2_QA_PUBLIC_CREATION: 'true',
      CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED: 'true',
      CUSTOM_LINEUP_CREATION_BUDGET_SECRET: 'isolated-budget-test-key-of-at-least-thirty-two',
      CUSTOM_V2_QA_SIMULATED_VERCEL_INGRESS: 'true',
    };
    expectGuard({ ...approved, CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED: '' },
      /CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED/);
    expectGuard({ ...approved, CUSTOM_LINEUP_CREATION_BUDGET_SECRET: 'short' },
      /isolated QA creation budget secret/);
    expectGuard({ ...approved, CUSTOM_V2_QA_SIMULATED_VERCEL_INGRESS: '' },
      /Explicit acknowledgement of locally simulated Vercel ingress/);
    expectGuard({ ...approved, DAILY_ADMIN_USERNAME: '', DAILY_ADMIN_PASSWORD: '' },
      /Exactly ten fixture IDs are required/);
  });

  it('rejects public QA with missing creation budget even when gameplay is enabled', () => {
    expectGuard({
      CUSTOM_V2_QA_PUBLIC_CREATION: 'true',
      CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED: 'true',
      CUSTOM_LINEUP_CREATION_BUDGET_SECRET: '',
      CUSTOM_V2_QA_SIMULATED_VERCEL_INGRESS: 'true',
    }, /CUSTOM_LINEUP_CREATION_BUDGET_SECRET/);
  });

  it('accepts the standalone project URL through provenance checks before fixtures', () => {
    // Intentionally invalid fixtures guarantee the runner cannot launch an HTTP server.
    expectGuard({}, /Exactly ten fixture IDs are required/);
  });
});
