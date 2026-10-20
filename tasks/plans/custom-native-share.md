# Native mobile share sheet for unlisted Custom Lineups

## Scope contract
- **Goal:** Let an issued Custom v2 creator use the device's native sharing options on browsers that support the Web Share API, while retaining the already-tested Copy link / selectable URL fallback.
- **Owning layer:** `apps/web` Custom Lineup share presentation.
- **In scope:** Capability-detected optional Share button, invocation in a direct click, cancellation/error handling, unit tests, release documentation.
- **Out of scope:** Issuance, cookies, owner management code, Custom gameplay, public activation, analytics, discovery, accounts, scoring, database, or browser polyfills.
- **Acceptance:** Native share receives only the absolute friend URL and innocuous app title, not puzzle contents, credentials or session data; cancel is silent, non-cancel errors recommend Copy link, and unsupported browsers have the old controls. Exact-head CI, READY Preview and one independent review required.
- **Stop:** If native-share support would require permissions, a new dependency, or transferring the owner capability, reject the scope expansion.

## Architecture
The existing validated opaque puzzle ID continues through the existing same-origin URL construction. The optional Web Share API is a browser-only presentation convenience, never an authority or answer transport. Native sharing takes only that URL; the existing copy/select behavior does not change. No new packages, network calls or server state. The JSX action is only rendered after capability detection and hydration.

## Documentation impact
Adds this bounded plan and one active task-list entry. Public creator release flags remain OFF.
