/** Loopback-only simulated ledger. No application server, Supabase, or real credentials. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

export const puzzleId = 'custom-lineup-v2-00000000-0000-4000-8000-000000000001';
export const cookieName = 'ib-custom-lineup-v2-attempt-' + puzzleId;
const api = '/api/custom-lineup/challenges/' + puzzleId;
export function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
export async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('QA event exceeded 10 seconds')), 10_000);
    })]);
  } finally { clearTimeout(timer); }
}
export async function serveFixture(bundle, n, headersFirst = false, malformedFirst = false) {
  const firstArrived = deferred();
  const secondArrived = deferred();
  const release = deferred();
  const firstFinished = deferred();
  const firstConnectionClosed = deferred();
  const ledger = new Map();
  const requests = [];
  const atBats = Array.from({ length: n }, (_, i) => ({ pitchNumber: i + 1, initials: 'P' + i }));
  const facts = atBats.map(p => ({ ...p, outcome: 'HR', hintsRevealed: 0,
    wrongGuesses: 0, resolution: 'correct' }));
  function payload(key) {
    const state = ledger.get(key);
    if (state.completed) return { attemptMode: 'completed', atBats,
      completedAtBats: facts, revision: n, completedAt: '2026-10-22T12:00:00Z' };
    return { attemptMode: 'reserved', puzzleId, rulesetVersion: 'points-v4', atBats,
      progressionToken: 'SIMULATED-' + key + '-' + state.strikes,
      hintBundle: { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
      attemptProgress: { strikeCount: state.strikes, completedAtBats: [] } };
  }
  const html = `<!doctype html><script src="/transport.js"></script><script>
    window.results = {}; window.view = null;
    const requests = IBBootstrapQA.createDailyGameplayRequestController();
    window.start = (label, unlocked = false, lifetime = false) => {
      const immediate = { request: (_name, _options, task) => task() };
      const client = unlocked
        ? IBBootstrapQA.createCustomLineupV2BrowserTransport(fetch, immediate)
        : IBBootstrapQA.createCustomLineupV2BrowserTransport();
      const execute = () => client.bootstrap('${puzzleId}');
      if (lifetime) {
        requests.invalidate();
        void requests.request({ execute, onStart() {},
          onSuccess: value => { window.view = { label, value }; },
          onError: error => { window.view = { label, error: error.kind }; },
          onSettled: () => { window.results[label] = { settled: true }; }
        });
      } else {
        void execute().then(value => { window.results[label] = { value }; },
          error => { window.results[label] = { error: error.kind }; });
      }
    };
  </script>`;
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => { res.destroy(); });
  });
  async function handle(req, res) {
    if (req.method === 'GET' && req.url === '/transport.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(bundle); return;
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/away')) {
      res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
      res.end(html); return;
    }
    if (req.method !== 'POST' || req.url !== api + '/attempt/bootstrap') {
      res.writeHead(404); res.end(); return;
    }
    const prior = (req.headers.cookie ?? '').split(';').map(x => x.trim())
      .find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    const key = prior ?? 'fixture-' + (ledger.size + 1);
    if (!prior) ledger.set(key, { strikes: 0, completed: false });
    assert.ok(ledger.has(key));
    const index = requests.length;
    requests.push({ cookie: prior ?? null, key });
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'private, no-store');
    if (!prior) res.setHeader('set-cookie', cookieName + '=' + key
      + '; Path=' + api + '; HttpOnly; SameSite=Strict; Max-Age=3600');
    if (index === 0) {
      res.once('close', () => firstConnectionClosed.resolve());
      if (headersFirst) res.flushHeaders();
      firstArrived.resolve();
      await release.promise;
    } else if (index === 1) secondArrived.resolve();
    res.end(index === 0 && malformedFirst ? '{' : JSON.stringify(payload(key)));
    if (index === 0) firstFinished.resolve();
  }
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  return { url, requests, ledger, firstArrived, secondArrived, firstFinished, firstConnectionClosed, release,
    async close() {
      release.resolve(); server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    } };
}
