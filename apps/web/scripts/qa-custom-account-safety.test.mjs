import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
