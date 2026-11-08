import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertCustomAccountQaEnvironment } from './qa-custom-account-safety.mjs';

const qa = {
  CUSTOM_V2_QA_PROJECT_REF: 'iklbnlicgsxxhaoiscor',
  SUPABASE_URL: 'https://iklbnlicgsxxhaoiscor.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'qa-secret-is-injected-at-runtime-not-source-000000',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public-qa-key-is-not-a-secret',
  CUSTOM_V2_QA_PLAYER_IDS: Array.from({length:10}, (_,i) =>
    'ibp_' + i.toString(16).padStart(20,'0')).join(','),
};
describe('account journey QA environmental safety gate', () => {
  it('accepts only the pinned isolated QA project and separate nonprivileged key', () => {
    assert.doesNotThrow(() => assertCustomAccountQaEnvironment(qa));
  });
  it('rejects production URL, disguised refs and arbitrary staging projects', () => {
    for(const override of [
      { CUSTOM_V2_QA_PROJECT_REF: 'dwreeiydvwikpamlokji' },
      { CUSTOM_V2_QA_PROJECT_REF: 'xxxxxxxxxxxxxxxxxxxx' },
      { SUPABASE_URL: 'https://dwreeiydvwikpamlokji.supabase.co' },
      { SUPABASE_URL: 'https://iklbnlicgsxxhaoiscor.supabase.co/' },
      { SUPABASE_URL: 'http://iklbnlicgsxxhaoiscor.supabase.co' },
    ]) assert.throws(() => assertCustomAccountQaEnvironment({...qa,...override}));
  });
  it('refuses missing or reused secrets, and malformed canonical fixtures', () => {
    for(const override of [
      { SUPABASE_SERVICE_ROLE_KEY: '' },
      { SUPABASE_PUBLISHABLE_KEY: qa.SUPABASE_SERVICE_ROLE_KEY },
      { SUPABASE_PUBLISHABLE_KEY: '' },
      { CUSTOM_V2_QA_PLAYER_IDS: 'ibp_invalid' },
    ]) assert.throws(() => assertCustomAccountQaEnvironment({...qa,...override}));
  });
});


describe('legacy signed Custom QA workflow isolated admin-credential gate (#531)', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/custom-v2-signed-qa.yml', import.meta.url), 'utf8');
  it('is manually dispatched only on protected main with a dedicated Environment', () => {
    assert.match(workflow, /on:\n  workflow_dispatch:\n/);
    assert.doesNotMatch(workflow, /\n  push:\n/);
    assert.ok(workflow.includes("if: github.ref == 'refs/heads/main'"));
    assert.ok(workflow.includes('environment: qa-custom-signed-browser'));
  });
  it('never references the old repository-wide admin key and fails closed without the Environment secret', () => {
    assert.ok(!workflow.includes('secrets.CUSTOM_V2_QA_SUPABASE_SERVICE_ROLE_KEY'));
    assert.ok(workflow.includes('secrets.QA_CUSTOM_SIGNED_BROWSER_SUPABASE_SERVICE_ROLE_KEY'));
    assert.ok(workflow.includes('test -n "$QA_SERVICE_ROLE"'));
  });
  it('pins the isolated QA project, keeps checkout credentials off, and restricts GITHUB_TOKEN', () => {
    assert.ok(workflow.includes('CUSTOM_V2_QA_PROJECT_REF: iklbnlicgsxxhaoiscor'));
    assert.ok(workflow.includes('SUPABASE_URL: https://iklbnlicgsxxhaoiscor.supabase.co'));
    assert.ok(!workflow.includes('dwreeiydvwikpamlokji'));
    assert.ok(workflow.includes('persist-credentials: false'));
    assert.match(workflow, /permissions:\n  contents: read/);
  });
  it('uses local-only ephemeral admin fixture issuance without obsolete anonymous account bypass', () => {
    assert.ok(workflow.includes("CUSTOM_V2_QA_PUBLIC_CREATION: 'false'"));
    assert.ok(workflow.includes("CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED: 'false'"));
    assert.ok(!workflow.includes('CUSTOM_V2_QA_SIMULATED_VERCEL_INGRESS'));
    assert.ok(workflow.includes('export DAILY_ADMIN_USERNAME=qa-signed-browser'));
    assert.ok(workflow.includes('export DAILY_ADMIN_PASSWORD="$(openssl rand -hex 32)"'));
    assert.ok(workflow.includes('::add-mask::$DAILY_ADMIN_PASSWORD'));
    const runner = readFileSync(new URL('./qa-custom-v2-hosted.mjs', import.meta.url), 'utf8');
    assert.ok(runner.includes('if (env.CUSTOM_V2_QA_PLAYWRIGHT_MODULE) {'));
    assert.ok(runner.includes('testPublicCreatorUi: publicCreatorQa'));
    assert.ok(workflow.includes('set -euo pipefail'));
    assert.ok(workflow.includes('node apps/web/scripts/qa-custom-v2-hosted.mjs 2>&1 | tee "$qa_log"'));
    for (const n of [1, 10]) {
      assert.ok(workflow.includes(
        "grep -Fxq 'PASS actual Chromium UI + isolated Supabase signed continuity N=" + n + "'",
      ), 'The privileged QA job must fail if native Chromium continuity is skipped');
    }
  });
});
