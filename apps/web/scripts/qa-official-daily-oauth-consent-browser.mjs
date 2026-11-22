#!/usr/bin/env node
/** Native Chromium/WebKit referrer/Origin regression. Synthetic loopback only; no OAuth service or credentials. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.OFFICIAL_DAILY_OAUTH_QA_PLAYWRIGHT_MODULE;
assert.ok(modulePath && isAbsolute(modulePath) && modulePath.endsWith('/playwright/index.mjs'),
  'Provide absolute QA-only Playwright module path');
const { chromium, webkit } = await import(pathToFileURL(modulePath).href);
const authorizationId = 'synthetic-authorization-id-12345';
const submissions = [];
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  + '<title>Fixture consent</title></head><body><main>'
  + '<form action="/api/official-daily/oauth/decision" method="post">'
  + '<input type="hidden" name="authorization_id" value="' + authorizationId + '">'
  + '<button type="submit" name="decision" value="approve">Authorize</button>'
  + '<button type="submit" name="decision" value="deny">Deny</button>'
  + '</form></main></body></html>';

const server = createServer(async (request, response) => {
  response.setHeader('cache-control', 'private, no-store');
  if (request.method === 'GET' && request.url === '/oauth/consent?authorization_id=' + authorizationId) {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.setHeader('referrer-policy', 'origin');
    response.setHeader('content-security-policy',
      "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    response.end(html);
  } else if (request.method === 'POST' && request.url === '/api/official-daily/oauth/decision') {
    let body = '';
    for await (const chunk of request) {
      body += chunk.toString('utf8');
      assert.ok(body.length <= 1024, 'Bound synthetic POST');
    }
    const params = new URLSearchParams(body);
    submissions.push({
      origin: request.headers.origin,
      referer: request.headers.referer,
      authorizationId: params.get('authorization_id'),
      decision: params.get('decision'),
      fields: [...params.keys()],
    });
    response.writeHead(303, { location: '/done', 'referrer-policy': 'no-referrer',
      'cache-control': 'private, no-store' }).end();
  } else if (request.method === 'GET' && request.url === '/done') {
    response.setHeader('content-type', 'text/plain');
    response.end('Consent fixture completed');
  } else response.writeHead(404).end();
});
server.headersTimeout = 10000;
server.requestTimeout = 10000;

const browsers = [];
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Loopback consent fixture start timed out')), 5000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.listen(0, '127.0.0.1', () => { clearTimeout(timer); resolve(); });
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Loopback port required');
  const origin = 'http://127.0.0.1:' + address.port;
  for (const [name, engine] of [['Chromium', chromium], ['WebKit', webkit]]) {
    const browser = await engine.launch({ headless: true, timeout: 20000 });
    browsers.push(browser);
    for (const [decision, button] of [['approve', 'Authorize'], ['deny', 'Deny']]) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      context.setDefaultTimeout(10000);
      context.setDefaultNavigationTimeout(15000);
      try {
        await context.route('**/*', route => {
          if (new URL(route.request().url()).origin !== origin) return route.abort();
          return route.continue();
        });
        const page = await context.newPage();
        const first = await page.goto(origin + '/oauth/consent?authorization_id=' + authorizationId,
          { waitUntil: 'domcontentloaded' });
        assert.equal(first?.status(), 200, name + ' consent fixture status');
        assert.equal(first?.headers()['referrer-policy'], 'origin',
          name + ' fixture policy must match actual route unit assertion');
        const previousCount = submissions.length;
        await page.getByRole('button', { name: button, exact: true }).click();
        await page.waitForURL(origin + '/done');
        assert.equal(submissions.length, previousCount + 1,
          name + ' must submit exactly one native form POST');
        const recorded = submissions.at(-1);
        assert.equal(recorded.origin, origin, name + ' must send exact Origin');
        assert.equal(recorded.referer, origin + '/',
          name + ' must not send authorization ID in Referer');
        assert.equal(recorded.authorizationId, authorizationId,
          name + ' must preserve hidden authorization ID in form body');
        assert.equal(recorded.decision, decision, name + ' must preserve explicit choice');
        assert.deepEqual(recorded.fields.sort(), ['authorization_id', 'decision']);
      } finally { await context.close(); }
    }
  }
  assert.equal(submissions.length, 4);
  console.log('PASS native OAuth form origin/privacy: Authorize and Deny in Chromium and WebKit; '
    + 'origin-only Referer, exact POST Origin. Synthetic loopback; not live OAuth acceptance.');
} finally {
  for (const browser of browsers) await browser.close();
  server.closeAllConnections();
  if (server.listening) await new Promise((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve()));
}
