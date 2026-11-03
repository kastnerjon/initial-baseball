import assert from 'node:assert/strict';

const QA_REF = 'iklbnlicgsxxhaoiscor';
const PROD_REF = 'dwreeiydvwikpamlokji';

/** Fail before making any Auth or game requests. Only this isolated project is writable. */
export function assertCustomAccountQaEnvironment(env) {
  const ref = env.CUSTOM_V2_QA_PROJECT_REF;
  assert.equal(ref, QA_REF, 'Only the pinned isolated QA Supabase project is allowed');
  assert.notEqual(ref, PROD_REF, 'Production database prohibited');
  assert.equal(env.SUPABASE_URL, 'https://' + QA_REF + '.supabase.co',
    'Supabase URL must match the isolated QA project exactly');
  assert.ok(typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string'
    && env.SUPABASE_SERVICE_ROLE_KEY.length > 32,
  'Dedicated QA service-role secret required');
  assert.ok(typeof env.SUPABASE_PUBLISHABLE_KEY === 'string'
    && env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')
    && env.SUPABASE_PUBLISHABLE_KEY !== env.SUPABASE_SERVICE_ROLE_KEY,
  'A distinct QA publishable key is required for SSR; never use the service-role key');
  assert.ok(typeof env.CUSTOM_V2_QA_PLAYER_IDS === 'string'
    && env.CUSTOM_V2_QA_PLAYER_IDS.split(',').length === 10
    && env.CUSTOM_V2_QA_PLAYER_IDS.split(',').every(id => /^ibp_[0-9a-f]{20}$/.test(id)),
  'Ten reviewed canonical fixture players required');
}
