import assert from 'node:assert/strict';

/** NextRequest canonicalizes loopback IP URLs to localhost; Origin must agree. */
export function createCustomV2QaBaseUrl(port) {
  assert.ok(Number.isInteger(port) && port >= 1 && port <= 65535, 'Invalid QA loopback port');
  return new URL('http://localhost:' + port + '/');
}
