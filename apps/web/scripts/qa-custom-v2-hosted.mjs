#!/usr/bin/env node
// Explicit, destructive-to-fixture HTTP acceptance. NEVER point at production.
// Run only with a disposable Supabase branch and a localhost Next.js server
// using that branch's service-role configuration.
import assert from 'node:assert/strict';

const env = process.env;
function required(name) {
  const value = env[name]?.trim();
  assert.ok(value, name + ' must be explicitly configured');
  return value;
}
const base = new URL(required('CUSTOM_V2_QA_BASE_URL'));
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname),
  'Hosted QA can only target a local Next server wired to an isolated hosted DB');
assert.equal(base.pathname, '/', 'Base URL must be site root');
assert.ok(base.protocol === 'http:' || base.protocol === 'https:');
const branchRef = required('CUSTOM_V2_QA_BRANCH_REF');
const productionRef = required('CUSTOM_V2_QA_PRODUCTION_REF');
assert.notEqual(branchRef, productionRef, 'Production Supabase is prohibited');
assert.match(branchRef, /^[a-z0-9]{20}$/);
assert.equal(new URL(required('SUPABASE_URL')).hostname,
  branchRef + '.supabase.co', 'Local server must use the specified branch URL');
required('SUPABASE_SERVICE_ROLE_KEY');
assert.equal(required('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED'), 'true',
  'Only local staging gameplay may be enabled');
const username = required('DAILY_ADMIN_USERNAME');
const password = required('DAILY_ADMIN_PASSWORD');
const players = required('CUSTOM_V2_QA_PLAYER_IDS').split(',').map(s => s.trim());
assert.equal(players.length, 10, 'Exactly ten fixture IDs are required');
assert.equal(new Set(players).size, 10, 'Fixtures must have distinct canonical IDs');
for (const id of players) assert.match(id, /^ibp_[0-9a-f]{20}$/);
const admin = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

function browser() {
  const cookies = new Map();
  return {
    async send(path, { method = 'POST', body, authorization, origin = base.origin } = {}) {
      const headers = { origin };
      if (authorization) headers.authorization = authorization;
      if (cookies.size) headers.cookie = [...cookies].map(([k, v]) => k + '=' + v).join('; ');
      if (body !== undefined) headers['content-type'] = 'application/json';
      const res = await fetch(new URL(path, base), {
        method, headers, redirect: 'manual',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        const pair = setCookie.split(';')[0];
        const i = pair.indexOf('=');
        assert.ok(i > 0, 'Malformed Set-Cookie');
        cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); }
      catch { data = null; }
      return { status: res.status, data, raw, headers: res.headers };
    },
  };
}

const acceptedLengths = [1, 5, 9, 10];
function attemptPath(id, action) {
  return '/api/custom-lineup/challenges/' + id + '/attempt/' + action;
}
async function createChallenge(n) {
  const creator = browser();
  const issued = await creator.send('/api/custom-lineup/challenges', {
    authorization: admin, body: { canonicalPlayerIds: players.slice(0, n) },
  });
  assert.equal(issued.status, 201, 'Admin issuance must succeed');
  assert.deepEqual(Object.keys(issued.data ?? {}), ['puzzleId'],
    'Creation must reveal only opaque challenge ID');
  const id = issued.data.puzzleId;
  assert.match(id, /^custom-lineup-v2-[0-9a-f-]{36}$/);
  assert.ok(issued.headers.get('set-cookie')?.includes('HttpOnly'),
    'Creator exclusion marker must be HttpOnly');
  const page = await creator.send('/custom/' + id, { method: 'GET' });
  assert.equal(page.status, 200, 'Staging gameplay page must render');
  assert.ok(!page.raw.includes('canonicalPlayerIds'),
    'Page HTML must not serialize answer IDs');
  for (const playerId of players.slice(0, n)) {
    assert.ok(!page.raw.includes(playerId), 'Page HTML must not contain selected answer IDs');
  }
  const preview = await creator.send(attemptPath(id, 'bootstrap'));
  assert.equal(preview.status, 200);
  assert.equal(preview.data.attemptMode, 'creator_preview');
  assert.equal(preview.data.atBats.length, n);
  const creatorSubmit = await creator.send(attemptPath(id, 'submit'));
  assert.equal(creatorSubmit.status, 403, 'Creator must never submit competitively');
  return id;
}
async function play(n) {
  const id = await createChallenge(n);
  const player = browser();
  let opening = await player.send(attemptPath(id, 'bootstrap'));
  assert.equal(opening.status, 200);
  assert.equal(opening.data.attemptMode, 'reserved');
  assert.equal(opening.data.atBats.length, n);
  assert.ok(opening.headers.get('set-cookie')?.includes('HttpOnly'));
  assert.ok(!opening.raw.includes('canonicalPlayerIds'));
  for (const answer of players.slice(0, n)) {
    assert.ok(!opening.raw.includes(answer), 'Bootstrap exposed unrevealed answer');
  }
  const early = await player.send(attemptPath(id, 'submit'));
  assert.equal(early.status, 409, 'Incomplete attempts cannot be submitted');
  const forged = await player.send(attemptPath(id, 'hint'), {
    body: { progressionToken: 'not-a-valid-signed-token' },
  });
  assert.ok([400, 409].includes(forged.status), 'Forged signed token was accepted');
  const crossOrigin = await player.send(attemptPath(id, 'resolve'), {
    origin: 'https://untrusted.invalid',
    body: { progressionToken: opening.data.progressionToken, giveUp: true },
  });
  assert.equal(crossOrigin.status, 403, 'Cross-origin mutation must be refused');

  let token = opening.data.progressionToken;
  const hinted = await player.send(attemptPath(id, 'hint'), {
    body: { progressionToken: token },
  });
  assert.equal(hinted.status, 200);
  token = hinted.data.progressionToken;
  const wrong = await player.send(attemptPath(id, 'resolve'), {
    body: { progressionToken: token, submittedPlayerId: players[1] },
  });
  assert.equal(wrong.status, 200);
  assert.equal(wrong.data.kind, 'incorrect');
  assert.equal(wrong.data.strikeCount, 1);
  token = wrong.data.progressionToken;
  const restored = await player.send(attemptPath(id, 'bootstrap'));
  assert.equal(restored.data.attemptMode, 'reserved');
  assert.equal(restored.data.hintBundle.revealedCount, 1);
  assert.equal(restored.data.attemptProgress.strikeCount, 1);
  assert.equal(restored.data.progressionToken, token);

  for (let p = 0; p < n; p++) {
    const resolved = await player.send(attemptPath(id, 'resolve'), {
      body: { progressionToken: token, submittedPlayerId: players[p] },
    });
    assert.equal(resolved.status, 200, 'Expected successful pitch ' + (p + 1));
    assert.equal(resolved.data.kind, 'terminal');
    assert.equal(resolved.data.completed, p === n - 1);
    assert.equal(resolved.data.result.outcome, p === 0 ? '3B' : 'HR');
    assert.equal(resolved.data.hintBundle?.pitchNumber ?? null, p === n - 1 ? null : p + 2);
    token = resolved.data.progressionToken;
    if (p === 0) {
      const replay = await player.send(attemptPath(id, 'resolve'), {
        body: { progressionToken: restored.data.progressionToken, submittedPlayerId: players[0] },
      });
      assert.ok([400, 409].includes(replay.status), 'Replayed token advanced attempt');
    }
  }
  const completed = await player.send(attemptPath(id, 'bootstrap'));
  assert.equal(completed.status, 200);
  assert.equal(completed.data.attemptMode, 'completed');
  assert.equal(completed.data.completedAtBats.length, n);
  assert.ok(!('progressionToken' in completed.data), 'Completed readback leaked live token');
  const earned = completed.data.completedAtBats.reduce(
    (sum, fact) => sum + (fact.outcome === 'HR' ? 4 : fact.outcome === '3B' ? 3 : 0), 0);
  assert.equal(earned, 4 * n - 1);
  const first = await player.send(attemptPath(id, 'submit'));
  assert.equal(first.status, 201, 'First completion must be admitted');
  assert.deepEqual(first.data, { status: 'created' });
  const duplicate = await player.send(attemptPath(id, 'submit'));
  assert.equal(duplicate.status, 200);
  assert.deepEqual(duplicate.data, { status: 'existing' });
  console.log('PASS Custom v2 hosted DB first-attempt N=' + n + ' maximum=' + (4 * n));
}
async function alternativeFinish(mode) {
  const id = await createChallenge(1);
  const player = browser();
  const opening = await player.send(attemptPath(id, 'bootstrap'));
  assert.equal(opening.data.attemptMode, 'reserved');
  let token = opening.data.progressionToken;
  if (mode === 'third-strike') {
    for (let i = 1; i <= 3; i++) {
      const r = await player.send(attemptPath(id, 'resolve'), {
        body: { progressionToken: token, submittedPlayerId: players[1] },
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.kind, i === 3 ? 'terminal' : 'incorrect');
      if (i === 3) assert.equal(r.data.result.outcome, 'K');
      token = r.data.progressionToken;
    }
  } else {
    const r = await player.send(attemptPath(id, 'resolve'), {
      body: { progressionToken: token, giveUp: true },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.kind, 'terminal');
  }
  const finished = await player.send(attemptPath(id, 'bootstrap'));
  assert.equal(finished.data.attemptMode, 'completed');
  assert.equal(finished.data.completedAtBats.length, 1);
  assert.equal((await player.send(attemptPath(id, 'submit'))).status, 201);
  console.log('PASS Custom v2 hosted DB ' + mode);
}

for (const n of acceptedLengths) await play(n);
await alternativeFinish('third-strike');
await alternativeFinish('give-up');
console.log('Hosted Custom v2 staged acceptance passed. No production changes.');

