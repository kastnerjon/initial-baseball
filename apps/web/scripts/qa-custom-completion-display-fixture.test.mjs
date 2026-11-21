import assert from 'node:assert/strict';
import test from 'node:test';
import { puzzleId, serveCompletionDisplayFixture } from './qa-custom-completion-display-fixture.mjs';

const endpoint = '/api/custom-lineup/challenges/' + puzzleId + '/completion/display';
const named = { mode: 'named', displayName: 'Fixture only' };
async function withFixture(options, check) {
  const fixture = await serveCompletionDisplayFixture('', options);
  try { await check(fixture); }
  finally { await fixture.close(); }
  assert.deepEqual(fixture.failures, []);
}
function post(fixture, choice) {
  return fetch(fixture.url + endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(choice),
  });
}
async function read(fixture) {
  const response = await fetch(fixture.url + endpoint);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  return response.json();
}

test('simulated endpoint preserves first named choice over a later Anonymous POST', async () => {
  await withFixture({}, async fixture => {
    assert.deepEqual(await read(fixture), { status: 'not_set' });
    const created = await post(fixture, named);
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { status: 'created' });
    const retry = await post(fixture, named);
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), { status: 'existing' });
    for (const conflict of [{ mode: 'anonymous' },
      { mode: 'named', displayName: 'Different name' }]) {
      const denied = await post(fixture, conflict);
      assert.equal(denied.status, 503);
      assert.deepEqual(await denied.json(), { error: 'session_unavailable' });
    }
    assert.deepEqual(await read(fixture), { status: 'saved', ...named });
    assert.equal(fixture.writes.length, 4);
  });
});

test('simulated winning Anonymous choice suppresses the submitted losing name', async () => {
  await withFixture({ winner: { mode: 'anonymous', displayName: null } }, async fixture => {
    const denied = await post(fixture, named);
    assert.equal(denied.status, 503);
    assert.deepEqual(await denied.json(), { error: 'session_unavailable' });
    const exact = await post(fixture, { mode: 'anonymous' });
    assert.equal(exact.status, 200);
    assert.deepEqual(await exact.json(), { status: 'existing' });
    assert.deepEqual(await read(fixture), { status: 'saved', mode: 'anonymous', displayName: null });
  });
});

test('repeated lost simulated POST replies preserve the first committed choice', async () => {
  await withFixture({ losePostResponse: true }, async fixture => {
    await assert.rejects(post(fixture, named));
    assert.equal(fixture.writes.length, 1);
    assert.deepEqual(await read(fixture), { status: 'saved', ...named });
    await assert.rejects(post(fixture, named));
    assert.deepEqual(await read(fixture), { status: 'saved', ...named });
    const conflict = await post(fixture, { mode: 'anonymous' });
    assert.equal(conflict.status, 503);
    assert.deepEqual(await conflict.json(), { error: 'session_unavailable' });
    assert.equal(fixture.writes.length, 3);
    assert.deepEqual(await read(fixture), { status: 'saved', ...named });
  });
});

test('failure modes distinguish read recovery from an uncommitted write', async () => {
  await withFixture({ failReadOnce: true, postFailure: true }, async fixture => {
    assert.equal((await fetch(fixture.url + endpoint)).status, 503);
    assert.deepEqual(await read(fixture), { status: 'not_set' });
    assert.equal((await post(fixture, named)).status, 503);
    assert.deepEqual(await read(fixture), { status: 'not_set' });
    assert.equal((await fetch(fixture.url + '/unrelated')).status, 404);
  });
});
