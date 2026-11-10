import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';

// DESIGN DIAGNOSTIC ONLY. This synchronous model assumes atomic unique inserts,
// exclusive origin locks, durable shared storage and correct cryptographic keys.
// Delivery/crash order is controlled explicitly. It proves no browser, database,
// network, entropy, key-lifetime or production scoring behavior.
const cookieName = generation => '__Host-ibd-v1-'
  + createHash('sha256').update(generation).digest('hex').slice(0, 32);
const digest = (keyId, capability) => createHmac('sha256', 'fixture-key-' + keyId)
  .update('daily-browser\0' + capability).digest('hex');

class ProtocolModel {
  initializations = new Map();
  aliases = new Map();
  reservations = new Map();
  retainedKeys = new Set(['old']);
  activeKey = 'old';
  nextIdentity = 0;

  initialize(generation) {
    // Assumed atomic generation insert: a duplicate cannot recover/re-mint raw
    // credentials. Pending remains pending even if the first response is lost.
    if (this.initializations.has(generation)) return null;
    const identity = 'identity-' + ++this.nextIdentity;
    const cookie = { keyId: this.activeKey, capability: 'fixture-capability-' + identity };
    this.initializations.set(generation, { identity });
    this.aliases.set(this.aliasKey(cookie), identity);
    return { generation, cookie }; // Only the first in-flight response has raw capability.
  }
  aliasKey(cookie, keyId = cookie.keyId) {
    return keyId + ':' + digest(keyId, cookie.capability);
  }
  resolve(cookie) {
    if (!cookie || !this.retainedKeys.has(cookie.keyId)) return null;
    return this.aliases.get(this.aliasKey(cookie)) ?? null;
  }
  confirm(generation, jar) {
    if (typeof generation !== 'string') return null;
    const identity = this.resolve(jar.get(cookieName(generation)));
    return identity && this.initializations.get(generation)?.identity === identity
      ? identity : null;
  }
  reserve(generation, jar, puzzleId, ruleset = 'points-v4') {
    const identity = this.confirm(generation, jar);
    if (!identity) return { mode: 'practice' };
    const key = JSON.stringify([identity, puzzleId, ruleset]);
    if (!this.reservations.has(key)) this.reservations.set(key, 'attempt-' + this.reservations.size);
    return { mode: 'live', identity, attempt: this.reservations.get(key) };
  }
  prepareAlias(cookie) {
    const identity = this.resolve(cookie);
    return identity ? { identity, source: cookie,
      target: { ...cookie, keyId: this.activeKey } } : null;
  }
  commitAlias(prepared) {
    if (!prepared || this.resolve(prepared.source) !== prepared.identity
      || !this.retainedKeys.has(prepared.target.keyId)) return false;
    const key = this.aliasKey(prepared.target);
    const existing = this.aliases.get(key);
    // Assumed atomic unique alias insert/check, never a last-writer overwrite.
    if (existing && existing !== prepared.identity) return false;
    this.aliases.set(key, prepared.identity);
    return true;
  }
}

class BrowserModel {
  generation = null;
  jar = new Map();
  holder = null;
  acquire(tab) {
    if (this.holder !== null) return false;
    this.holder = tab; return true;
  }
  begin(server, tab, generation) {
    assert.equal(this.holder, tab, 'Initialization requires the origin-wide lock');
    this.generation ??= generation; // Assumed durable before issuing request.
    return server.initialize(this.generation);
  }
  release(tab) { assert.equal(this.holder, tab); this.holder = null; }
  deliver(response) {
    if (response) this.jar.set(cookieName(response.generation), response.cookie);
  }
  start(server, edition = 'edition-a') {
    return server.reserve(this.generation, this.jar, edition);
  }
}

test('two tabs wait for one origin lock and reuse the confirmed identity', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  assert.ok(b.acquire('first'));
  const response = b.begin(s, 'first', 'generation-a');
  assert.equal(b.acquire('second'), false);
  b.deliver(response);
  const original = b.start(s);
  b.release('first');
  assert.ok(b.acquire('second'));
  assert.equal(b.begin(s, 'second', 'ignored-generation'), null);
  assert.deepEqual(b.start(s), original);
  assert.equal(s.initializations.size, 1);
  assert.equal(s.reservations.size, 1);
});

test('crashed holder with stalled response leaves successor practice-only until delivery', () => {
  for (const edition of ['edition-a', 'edition-b']) {
    const s = new ProtocolModel(), b = new BrowserModel();
    b.acquire('first');
    const delayed = b.begin(s, 'first', 'generation-a');
    b.release('first'); // Model a crash: shared generation survives, lock releases.
    b.acquire('successor');
    assert.equal(b.begin(s, 'successor', 'unused'), null);
    const before = [...b.jar];
    assert.equal(b.start(s, edition).mode, 'practice');
    assert.deepEqual([...b.jar], before, 'Readback never sets a cookie');
    assert.equal(s.reservations.size, 0);
    b.deliver(delayed);
    const accepted = b.start(s, edition);
    assert.equal(accepted.mode, 'live');
    assert.deepEqual(b.start(s, edition), accepted);
    assert.equal(s.nextIdentity, 1);
    assert.equal(s.reservations.size, 1);
  }
});

test('permanently lost response cannot be repaired by minting again for the generation', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  b.acquire('first'); b.begin(s, 'first', 'generation-a'); b.release('first');
  b.acquire('successor');
  for (let retry = 0; retry < 3; retry++) {
    assert.equal(b.begin(s, 'successor', 'unused'), null);
    assert.equal(b.start(s).mode, 'practice');
  }
  assert.equal(s.nextIdentity, 1);
  assert.equal(s.reservations.size, 0);
  assert.deepEqual([...s.initializations.values()], [{ identity: 'identity-1' }]);
});

test('blocked cookies fail closed even after initialization delivery', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  b.acquire('first'); b.begin(s, 'first', 'generation-a');
  // Browser rejects the response cookie: no confirmed capability enters its jar.
  assert.equal(b.start(s).mode, 'practice');
  assert.equal(s.reservations.size, 0);
});

test('missing lock or selected generation cannot authorize initialization or adopt old cookies', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  assert.throws(() => b.begin(s, 'unsupported-lock', 'generation-a'));
  assert.equal(b.start(s).mode, 'practice');
  b.acquire('first'); b.deliver(b.begin(s, 'first', 'generation-a'));
  b.generation = null;
  assert.equal(b.start(s).mode, 'practice');
  assert.equal(s.reservations.size, 0);
});

test('lost confirmed cookie never reallocates the existing generation or changes its attempt', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  b.acquire('first'); b.deliver(b.begin(s, 'first', 'generation-a'));
  const original = b.start(s), stored = [...s.reservations];
  b.jar.clear();
  assert.equal(b.begin(s, 'first', 'unused'), null);
  assert.equal(b.start(s).mode, 'practice');
  assert.deepEqual([...s.reservations], stored);
  assert.equal(s.nextIdentity, 1);
  assert.equal(original.mode, 'live');
});

for (const order of [[0, 1], [1, 0]]) {
  test('storage loss fences old cookie delivery order ' + order.join(','), () => {
    const s = new ProtocolModel(), b = new BrowserModel();
    b.acquire('first');
    const old = b.begin(s, 'first', 'generation-old'); b.release('first');
    b.generation = null; // Identity loss, explicitly outside retained-generation guarantee.
    b.acquire('successor');
    const current = b.begin(s, 'successor', 'generation-current');
    for (const index of order) {
      b.deliver([old, current][index]);
      if (!b.jar.has(cookieName('generation-current'))) {
        assert.equal(b.start(s).mode, 'practice', 'Old cookie must never be promoted');
      }
    }
    const result = b.start(s);
    assert.equal(result.identity, s.initializations.get('generation-current').identity);
    assert.deepEqual(b.start(s), result);
    assert.equal(s.reservations.size, 1);
  });
}

test('two editions share one browser identity but keep exact-ID reservations separate', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  b.acquire('first'); b.deliver(b.begin(s, 'first', 'generation-a'));
  const a = b.start(s, 'edition-a'), other = b.start(s, 'edition-b');
  assert.equal(a.identity, other.identity);
  assert.notEqual(a.attempt, other.attempt);
  assert.deepEqual(b.start(s, 'edition-a'), a);
  assert.equal(s.reservations.size, 2);
});

test('concurrent alias proposals and old/new lookups retain one identity/reservation', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  b.acquire('first'); b.deliver(b.begin(s, 'first', 'generation-a'));
  const original = b.start(s), oldCookie = b.jar.get(cookieName(b.generation));
  s.retainedKeys.add('new'); s.activeKey = 'new';
  const first = s.prepareAlias(oldCookie), second = s.prepareAlias(oldCookie);
  assert.equal(s.resolve(first.target), null, 'Absent new alias never mints an identity');
  assert.ok(s.commitAlias(second)); assert.ok(s.commitAlias(first));
  assert.equal(s.resolve(oldCookie), original.identity);
  assert.equal(s.resolve(first.target), original.identity);
  b.jar.set(cookieName(b.generation), first.target);
  assert.deepEqual(b.start(s), original);
  assert.equal(s.nextIdentity, 1);
  assert.equal(s.reservations.size, 1);
});

test('conflicting aliases and key revocation fail closed without a new reservation', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  b.acquire('first'); b.deliver(b.begin(s, 'first', 'generation-a'));
  const cookie = b.jar.get(cookieName(b.generation));
  s.retainedKeys.add('new'); s.activeKey = 'new';
  const prepared = s.prepareAlias(cookie);
  s.aliases.set(s.aliasKey(prepared.target), 'conflicting-identity');
  assert.equal(s.commitAlias(prepared), false);
  b.jar.set(cookieName(b.generation), prepared.target);
  assert.equal(b.start(s).mode, 'practice', 'Generation/identity mismatch fails closed');
  b.jar.set(cookieName(b.generation), cookie);
  s.retainedKeys.delete('old');
  assert.equal(b.start(s).mode, 'practice');
  assert.equal(s.prepareAlias(cookie), null);
  assert.equal(s.reservations.size, 0);
  assert.equal(s.nextIdentity, 1);
});

test('one edition and browser cannot reuse a reservation across different issued rulesets', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  b.acquire('first'); b.deliver(b.begin(s, 'first', 'generation-a'));
  const original = s.reserve(b.generation, b.jar, 'edition-a', 'points-v4');
  const different = s.reserve(b.generation, b.jar, 'edition-a', 'synthetic-ruleset-v5');
  assert.equal(original.identity, different.identity);
  assert.notEqual(original.attempt, different.attempt);
  assert.deepEqual(s.reserve(b.generation, b.jar, 'edition-a', 'points-v4'), original);
  assert.deepEqual(s.reserve(b.generation, b.jar, 'edition-a', 'synthetic-ruleset-v5'), different);
  assert.equal(s.reservations.size, 2);
  // The diagnostic models scoping only; a real issuer must separately validate its issued ruleset.
});

test('a valid old capability copied under a new generation cookie name fails identity binding', () => {
  const s = new ProtocolModel(), b = new BrowserModel();
  b.acquire('first');
  const old = b.begin(s, 'first', 'generation-old');
  b.deliver(old);
  const first = b.start(s);
  assert.equal(first.mode, 'live');
  // Storage deletion is identity loss, not recovery of the previous browser identity.
  b.generation = null;
  const current = b.begin(s, 'first', 'generation-current');
  assert.ok(current);
  b.jar.set(cookieName('generation-current'), old.cookie);
  assert.equal(b.start(s).mode, 'practice',
    'Even a genuine prior cookie must match the selected generation identity');
  assert.equal(s.reservations.size, 1);
  b.deliver(current);
  const admitted = b.start(s);
  assert.equal(admitted.mode, 'live');
  assert.notEqual(admitted.identity, first.identity);
  assert.equal(s.reservations.size, 2,
    'After browser-data loss, a separately confirmed generation can be a new anonymous identity');
});
