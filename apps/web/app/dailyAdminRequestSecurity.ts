export function isSameOriginDailyAdminMutation(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin === null || origin === new URL(request.url).origin;
}


/**
 * Private GETs need Fetch Metadata admission because browser subresources can
 * omit Origin entirely. Same-site is not the same thing as same-origin.
 * Legacy mutations retain their existing, separately reviewed policy.
 */
export function isSameOriginDailyAdminRead(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('origin');
  if (origin !== null) return origin === new URL(request.url).origin;
  // Unknown/legacy browser context is not evidence of an authorized
  // first-party admin read. Direct navigation has site=none.
  return site === 'same-origin' || site === 'none';
}
