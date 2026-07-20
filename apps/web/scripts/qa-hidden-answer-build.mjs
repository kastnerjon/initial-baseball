import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { once } from 'node:events';

const buildDirectory = resolve(process.cwd(), '.next');
const clientChunkPaths = walkFiles(resolve(buildDirectory, 'static/chunks'))
  .filter((path) => path.endsWith('.js'));
const canonicalIdPattern = /ibp_[0-9a-f]{20}/;
const legacyIdPattern = /chadwick:[0-9a-f]{8}/;
const privateFields = ['correctPlayerId', 'revealShard', 'careerStats', 'dailyEligibilityTier'];

const initialPayload = await renderBuiltInitialPage();
assertSafeInitialPayload('live built initial page', initialPayload);

for (const path of clientChunkPaths) {
  const content = readFileSync(path, 'utf8');
  assertAbsent(path, content, canonicalIdPattern, 'embedded canonical player ID');
  assertAbsent(path, content, legacyIdPattern, 'embedded legacy player ID');
}

const clientBytes = clientChunkPaths.reduce((total, path) => total + statSync(path).size, 0);
console.log(
  `Hidden-answer build QA passed for the live initial page and ${clientChunkPaths.length} client chunks (${clientBytes} bytes).`,
);

async function renderBuiltInitialPage() {
  const port = await getAvailablePort();
  const nextBinary = resolve(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'next.cmd' : 'next',
  );
  if (!existsSync(nextBinary)) {
    throw new Error(`Could not find the built Next.js executable at ${nextBinary}.`);
  }

  const environment = { ...process.env, NODE_ENV: 'production' };
  delete environment.VERCEL;
  const child = spawn(
    nextBinary,
    ['start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: process.cwd(),
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let serverOutput = '';
  child.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    const url = `http://127.0.0.1:${port}/`;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) {
        throw new Error(
          `Built Next.js server exited with code ${child.exitCode}.\n${serverOutput}`,
        );
      }

      try {
        const response = await fetch(url, {
          headers: {
            'cache-control': 'no-store',
          },
        });
        if (response.ok) {
          return await response.text();
        }
        serverOutput += `\nInitial page returned HTTP ${response.status}.`;
      } catch {
        // The server may still be starting.
      }
      await delay(250);
    }

    throw new Error(`Built Next.js server did not become ready.\n${serverOutput}`);
  } finally {
    await stopChild(child);
  }
}

function assertSafeInitialPayload(label, content) {
  assertAbsent(label, content, canonicalIdPattern, 'canonical player ID');
  assertAbsent(label, content, legacyIdPattern, 'legacy player ID');
  for (const privateField of privateFields) {
    assertAbsent(label, content, new RegExp(privateField), `private field ${privateField}`);
  }
}

function assertAbsent(path, content, pattern, label) {
  if (pattern.test(content)) {
    throw new Error(`Hidden-answer build QA found ${label} in ${path}.`);
  }
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

async function getAvailablePort() {
  const server = createServer();
  server.unref();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error('Could not allocate a port for hidden-answer build QA.');
  }
  const { port } = address;
  await new Promise((resolvePromise, reject) => {
    server.close((error) => error ? reject(error) : resolvePromise());
  });
  return port;
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    delay(2000),
  ]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
