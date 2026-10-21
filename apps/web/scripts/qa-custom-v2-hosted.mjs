#!/usr/bin/env node
// Explicit, destructive-to-fixture HTTP acceptance. NEVER point at production.
// Starts its own localhost Next server with validated isolated project credentials.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createCustomV2QaBaseUrl } from './qa-custom-v2-hosted-origin.mjs';

const env = process.env;
function required(name) {
  const value = env[name]?.trim();
  assert.ok(value, name + ' must be explicitly configured');
  return value;
}
// Never let the operator supply the production ref as an arbitrary comparison value.
const PRODUCTION_REF = 'dwreeiydvwikpamlokji';
const projectRef = required('CUSTOM_V2_QA_PROJECT_REF');
assert.notEqual(projectRef, PRODUCTION_REF, 'Production Supabase is prohibited');
assert.match(projectRef, /^[a-z0-9]{20}$/);
const projectUrl = new URL(required('SUPABASE_URL'));
assert.equal(projectUrl.href, 'https://' + projectRef + '.supabase.co/',
  'Staging API must use exact HTTPS URL of the specified nonproduction project');
required('SUPABASE_SERVICE_ROLE_KEY');
assert.ok(required('DAILY_PROGRESSION_SECRET').length >= 32,
  'An isolated staging signing secret is required');
assert.equal(required('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED'), 'true',
  'Only local staging gameplay may be enabled');
// Optional QA-only public issuance path: simulated Vercel ingress over loopback.
// This cannot prove real Vercel header trust, mobile behavior, WAF or public rollout.
const publicCreatorQa = env.CUSTOM_V2_QA_PUBLIC_CREATION === 'true';
if (publicCreatorQa) {
  assert.equal(required('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED'), 'true',
    'Public creation must be enabled only in the isolated QA child server');
  assert.ok(required('CUSTOM_LINEUP_CREATION_BUDGET_SECRET').trim().length >= 32,
    'A distinct isolated QA creation budget secret is required');
  assert.equal(env.CUSTOM_V2_QA_SIMULATED_VERCEL_INGRESS, 'true',
    'Explicit acknowledgement of locally simulated Vercel ingress is required');
}
const username = publicCreatorQa ? null : required('DAILY_ADMIN_USERNAME');
const password = publicCreatorQa ? null : required('DAILY_ADMIN_PASSWORD');
const players = required('CUSTOM_V2_QA_PLAYER_IDS').split(',').map(s => s.trim());
assert.equal(players.length, 10, 'Exactly ten fixture IDs are required');
assert.equal(new Set(players).size, 10, 'Fixtures must have distinct canonical IDs');
for (const id of players) assert.match(id, /^ibp_[0-9a-f]{20}$/);
const admin = publicCreatorQa ? null : 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

// The runner owns the tested Next.js process, avoiding mismatched local server
// environments and refusing to reuse an unrelated process on a fixed port.
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const nextBinary = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
let base;
async function reserveLocalPort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}
async function startValidatedWebServer() {
  const port = await reserveLocalPort();
  base = createCustomV2QaBaseUrl(port);
  const child = spawn(process.execPath,
    [nextBinary, 'start', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: webRoot, env: {
        ...env, PORT: String(port), HOSTNAME: '127.0.0.1',
        ...(publicCreatorQa ? { VERCEL: '1', VERCEL_ENV: 'preview' } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  child.stdout.resume();
  child.stderr.resume();
  for (let tries = 0; tries < 120; tries++) {
    if (child.exitCode !== null) break;
    try {
      const health = await fetch(base, { signal: AbortSignal.timeout(1500) });
      if (health.status === 200) return child;
    } catch { /* process may not be listening yet */ }
    await delay(250);
  }
  child.kill('SIGTERM');
  throw new Error('Isolated staging Next.js server did not become ready');
}


function browser() {
  const cookies = new Map();
  return {
    async send(path, { method = 'POST', body, authorization, origin = base.origin,
      qaForwardedIp } = {}) {
      const headers = { origin };
      if (authorization) headers.authorization = authorization;
      // Only an explicit QA-only caller may simulate edge-controlled headers.
      if (qaForwardedIp !== undefined) {
        assert.ok(publicCreatorQa, 'Synthetic ingress cannot be used in normal hosted QA');
        headers['x-forwarded-for'] = qaForwardedIp;
        headers['x-vercel-forwarded-for'] = qaForwardedIp;
      }
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

const acceptedLengths = Array.from({ length: 10 }, (_, i) => i + 1);
function attemptPath(id, action) {
  return '/api/custom-lineup/challenges/' + id + '/attempt/' + action;
}
let simulatedIpSequence = 10;
async function createChallenge(n) {
  const creator = browser();
  // Unique TEST-NET IP per fixture avoids spending the same ten-in-ten-minutes
  // budget across twelve scenarios. It is NOT a WAF or IP-identity test.
  const qaForwardedIp = publicCreatorQa ? '192.0.2.' + (++simulatedIpSequence) : undefined;
  const issued = await creator.send(publicCreatorQa
    ? '/api/custom-lineup/create' : '/api/custom-lineup/challenges', {
    ...(publicCreatorQa ? { qaForwardedIp } : { authorization: admin }),
    body: { canonicalPlayerIds: players.slice(0, n),
      ...(publicCreatorQa ? { title: 'QA Private Lineup ' + n } : {}) },
  });
  assert.equal(issued.status, 201, 'Staged issuance must succeed');
  if (publicCreatorQa) {
    assert.deepEqual(Object.keys(issued.data ?? {}).sort(), ['ownerCapability', 'puzzleId'],
      'Anonymous issue response must contain only the puzzle ID and separate owner code');
    assert.match(issued.data.ownerCapability, /^[A-Za-z0-9_-]{43}$/,
      'Owner management code must be 32 bytes of base64url');
    assert.ok(!JSON.stringify([...issued.headers]).includes(issued.data.ownerCapability),
      'Owner management code must not enter response headers');
  } else {
    assert.deepEqual(Object.keys(issued.data ?? {}), ['puzzleId'],
      'Admin issuance must reveal only opaque challenge ID');
  }
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
  if (publicCreatorQa && n === 1) {
    const createPage = await creator.send('/create', { method: 'GET' });
    assert.equal(createPage.status, 200, 'Public creator page must render in isolated QA');
    assert.ok(createPage.raw.includes('Name your puzzle'),
      'Public creator page must present the required name');
    assert.ok(!createPage.raw.includes(issued.data.ownerCapability),
      'Owner capability must not be embedded in creator page HTML');
    const forbidden = await creator.send('/api/custom-lineup/create', {
      origin: 'https://untrusted.invalid',
      qaForwardedIp,
      body: { canonicalPlayerIds: players.slice(0, n), title: 'Rejected cross-origin issue' },
    });
    assert.equal(forbidden.status, 403, 'Cross-origin anonymous issuance must fail');
    const missingEdge = await creator.send('/api/custom-lineup/create', {
      body: { canonicalPlayerIds: players.slice(0, n), title: 'Rejected no-edge issue' },
    });
    assert.equal(missingEdge.status, 503,
      'Anonymous issuance without trusted Vercel ingress must fail closed');
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
  console.log('PASS ' + (publicCreatorQa ? 'no-sign-in creator + friend ' : '')
    + 'Custom v2 hosted DB first-attempt N=' + n + ' maximum=' + (4 * n));
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

// Reserved documentation IPv6 addresses, never real clients or production traffic.
function randomQaIp() {
  const groups = randomBytes(12).toString('hex').match(/.{4}/g);
  assert.ok(groups && groups.length === 6);
  return '2001:db8:' + groups.join(':');
}

/** QA-only quota exercise; synthetic local ingress is not a Vercel WAF proof. */
// Database rate windows are fixed epoch-aligned ten-minute buckets. Run every
// observation inside one stable window; otherwise start again with a fresh IP.
async function verifyAnonymousCreationBudget() {
  assert.ok(publicCreatorQa, 'Quota QA requires anonymous mode');
  const body = { canonicalPlayerIds: players.slice(0, 1), title: 'QA private quota fixture' };
  const windowMs = 10 * 60 * 1000;
  const guardMs = 30 * 1000;
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = Date.now();
    const offset = now % windowMs;
    if (offset < guardMs || offset > windowMs - 90 * 1000) {
      // Avoid a false pass/failure at DB bucket rollover, without emitting
      // any quota evidence from the ambiguous portion of the window.
      const waitMs = offset < guardMs
        ? guardMs - offset
        : windowMs - offset + guardMs;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    const begin = Date.now();
    const window = Math.floor(begin / windowMs);
    const ip = randomQaIp();
    const creator = browser();
    const malformed = await creator.send('/api/custom-lineup/create', {
      qaForwardedIp: ip, body: { ...body, canonicalPlayerIds: [] },
    });
    const accepted = [];
    for (let i = 0; i < 10; i++) {
      accepted.push(await creator.send('/api/custom-lineup/create', {
        qaForwardedIp: ip, body,
      }));
    }
    const denied = await creator.send('/api/custom-lineup/create', {
      qaForwardedIp: ip, body,
    });
    const independent = await browser().send('/api/custom-lineup/create', {
      qaForwardedIp: randomQaIp(), body,
    });
    const finish = Date.now();
    if (Math.floor(finish / windowMs) !== window
      || finish % windowMs > windowMs - guardMs) {
      console.log('QA budget test crossed a ten-minute bucket; retrying with fresh IP');
      continue;
    }
    assert.equal(malformed.status, 400, 'Malformed selection must fail before quota');
    assert.deepEqual(malformed.data, { error: 'invalid_selection' });
    for (const response of accepted) {
      assert.equal(response.status, 201, 'First ten same-IP requests must be admitted');
      assert.match(response.data?.puzzleId ?? '', /^custom-lineup-v2-[0-9a-f-]{36}$/);
    }
    assert.equal(denied.status, 429, 'Eleventh same-IP request must be denied');
    assert.deepEqual(denied.data, { error: 'creation_limit_reached' });
    const retry = Number(denied.headers.get('retry-after'));
    assert.ok(Number.isInteger(retry) && retry >= 1 && retry <= 600,
      'Ten-minute fixed window must provide a positive Retry-After');
    assert.equal(denied.headers.get('set-cookie'), null,
      'Denied request must not issue an owner-preview cookie');
    assert.equal(independent.status, 201, 'Unrelated IP budget must be independent');
    console.log('PASS QA creation budget: ten accepted, eleventh denied, other IP admitted');
    return;
  }
  throw new Error('Could not verify quota within one stable ten-minute database window');
}


// A concurrent burst must never admit more than the database's fixed-window
// allowance. Each simulated client has a separate cookie jar; all share one
// synthetic edge-derived IP. Not a proof of real Vercel edge enforcement.
async function verifyConcurrentAnonymousCreationBudget() {
  assert.ok(publicCreatorQa, 'Concurrent quota QA requires anonymous mode');
  const body = { canonicalPlayerIds: players.slice(0, 1), title: 'QA concurrent quota fixture' };
  const windowMs = 10 * 60 * 1000;
  const guardMs = 30 * 1000;
  for (let attempt = 0; attempt < 3; attempt++) {
    const offset = Date.now() % windowMs;
    if (offset < guardMs || offset > windowMs - 90 * 1000) {
      const waitMs = offset < guardMs ? guardMs - offset : windowMs - offset + guardMs;
      await delay(waitMs);
    }
    const window = Math.floor(Date.now() / windowMs);
    const ip = randomQaIp();
    const responses = await Promise.all(Array.from({ length: 12 }, () =>
      browser().send('/api/custom-lineup/create', { qaForwardedIp: ip, body })));
    const finish = Date.now();
    if (Math.floor(finish / windowMs) !== window || finish % windowMs > windowMs - guardMs) {
      console.log('Concurrent QA budget crossed a fixed window; retrying with fresh IP');
      continue;
    }
    const accepted = responses.filter(response => response.status === 201);
    const denied = responses.filter(response => response.status === 429);
    assert.equal(accepted.length, 10, 'Concurrent admission must commit exactly ten');
    assert.equal(denied.length, 2, 'Concurrent overflow must deny exactly two');
    assert.equal(new Set(accepted.map(response => response.data?.puzzleId)).size, 10,
      'Successful concurrent issuance must yield ten distinct immutable challenges');
    for (const response of accepted) {
      assert.match(response.data?.puzzleId ?? '', /^custom-lineup-v2-[0-9a-f-]{36}$/);
      assert.match(response.data?.ownerCapability ?? '', /^[A-Za-z0-9_-]{43}$/);
      assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/);
    }
    for (const response of denied) {
      assert.deepEqual(response.data, { error: 'creation_limit_reached' });
      const retry = Number(response.headers.get('retry-after'));
      assert.ok(Number.isInteger(retry) && retry >= 1 && retry <= 600,
        'Concurrent denial must have bounded Retry-After');
      assert.equal(response.headers.get('set-cookie'), null,
        'Concurrent denial must not issue a creator credential cookie');
    }
    console.log('PASS QA concurrent creation quota: ten admitted, two denied, distinct owner credentials');
    return;
  }
  throw new Error('Could not verify concurrent quota within one stable ten-minute window');
}

const server = await startValidatedWebServer();
try {
  for (const n of acceptedLengths) await play(n);
  await alternativeFinish('third-strike');
  await alternativeFinish('give-up');
  if (publicCreatorQa) await verifyAnonymousCreationBudget();
  if (publicCreatorQa) await verifyConcurrentAnonymousCreationBudget();
  console.log('Hosted Custom v2 ' + (publicCreatorQa
    ? 'QA-only simulated-ingress anonymous creator + friend'
    : 'admin creator + friend') + ' acceptance passed on isolated nonproduction project.');
  if (publicCreatorQa) console.log(
    'NOT VERIFIED: genuine Vercel ingress, mobile browser, live WAF, public activation.');
} finally {
  server.kill('SIGTERM');
}

