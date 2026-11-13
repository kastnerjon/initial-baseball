/** Only loopback fixture requests may leave the credential-free QA browser. */
export function isIsolationFixtureRequestAllowed(request, origin) {
  try {
    const fixture = new URL(origin);
    return fixture.protocol === 'http:' && fixture.hostname === '127.0.0.1'
      && fixture.port !== '' && fixture.username === '' && fixture.password === ''
      && fixture.origin === origin && new URL(request).origin === origin;
  } catch { return false; }
}

export function createIsolationBrowserEnvironment(host) {
  return {
    PATH: host.PATH || '/usr/bin:/bin', HOME: host.HOME || '/tmp',
    LANG: host.LANG || 'C.UTF-8', TMPDIR: host.TMPDIR || '/tmp',
  };
}
