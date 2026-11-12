/** Simulated HTTP choice ledger; never a signed application/SQL acceptance test. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

export const puzzleId = 'custom-lineup-v2-00000000-0000-4000-8000-000000000001';
const endpoint = '/api/custom-lineup/challenges/' + puzzleId + '/completion/display';

export async function serveCompletionDisplayFixture(bundle, options = {}) {
  let saved = options.saved ?? null;
  let failRead = options.failReadOnce ?? false;
  const writes = [];
  const reads = [];
  const failures = [];
  const server = createServer((request, response) => {
    void handle(request, response).catch(() => {
      failures.push('Fixture contract failed');
      response.destroy();
    });
  });
  async function handle(request, response) {
    response.setHeader('cache-control', 'private, no-store');
    if (request.method === 'GET' && request.url === '/') {
      response.setHeader('content-type', 'text/html');
      response.end('<!doctype html><meta name="viewport" content="width=device-width">'
        + '<div id="root"></div><script src="/component.js"></script>');
      return;
    }
    if (request.method === 'GET' && request.url === '/component.js') {
      response.setHeader('content-type', 'text/javascript');
      response.end(bundle);
      return;
    }
    if (request.url !== endpoint || !['GET', 'POST'].includes(request.method)) {
      response.writeHead(404); response.end(); return;
    }
    assert.equal(request.headers.referer, undefined, 'Transport must withhold referrer');
    response.setHeader('content-type', 'application/json');
    if (request.method === 'GET') {
      reads.push(true);
      if (failRead) {
        failRead = false;
        response.writeHead(503); response.end('{}'); return;
      }
      response.end(JSON.stringify(saved === null ? { status: 'not_set' }
        : { status: 'saved', ...saved }));
      return;
    }
    assert.equal(request.headers['content-type'], 'application/json');
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
      assert.ok(chunks.reduce((total, item) => total + item.length, 0) <= 4096);
    }
    const choice = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.ok(choice.mode === 'named' || choice.mode === 'anonymous');
    assert.deepEqual(Object.keys(choice).sort(), choice.mode === 'named'
      ? ['displayName', 'mode'] : ['mode']);
    writes.push(choice);
    if (options.postFailure) { response.writeHead(503); response.end('{}'); return; }
    if (options.winner) saved = options.winner;
    const existing = saved !== null;
    if (!existing) saved = choice.mode === 'anonymous'
      ? { mode: 'anonymous', displayName: null } : choice;
    if (options.losePostResponse) { response.destroy(); return; }
    response.end(JSON.stringify({ status: existing ? 'existing' : 'created' }));
  }
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return {
    url: 'http://127.0.0.1:' + server.address().port,
    writes, reads, failures,
    async close() {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
