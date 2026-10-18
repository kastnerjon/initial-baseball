import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { createCustomV2QaBaseUrl } from './qa-custom-v2-hosted-origin.mjs';
const { NextRequest } = createRequire(import.meta.url)('next/server');

describe('hosted QA origin agrees with real NextRequest normalization', () => {
  it('reproduces the former IP-origin mismatch and fixes it without relaxing the check', () => {
    const old = new NextRequest('http://127.0.0.1:34567/api/custom-lineup/challenges');
    assert.notEqual(new URL(old.url).origin, 'http://127.0.0.1:34567');
    const base = createCustomV2QaBaseUrl(34567);
    const request = new NextRequest(new URL('/api/custom-lineup/challenges', base), {
      method: 'POST', headers: { origin: base.origin },
    });
    assert.equal(request.headers.get('origin'), new URL(request.url).origin);
    assert.equal(base.hostname, 'localhost');
    assert.equal(base.protocol, 'http:');
    assert.equal(base.port, '34567');
    assert.notEqual('https://untrusted.invalid', new URL(request.url).origin);
  });
  it('rejects invalid ports instead of accepting an arbitrary request destination', () => {
    for (const port of [0, -1, 65536, 1.5, NaN, '34567']) {
      assert.throws(() => createCustomV2QaBaseUrl(port), /Invalid QA loopback port/);
    }
  });
});
