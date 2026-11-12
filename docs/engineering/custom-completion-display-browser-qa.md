# Custom completion display component browser acceptance

The `qa-custom-completion-display-browser.mjs` runner bundles the actual
`CustomLineupCompletionDisplay` React component, its browser transport and the
shared display-name parser. A disposable HTTP server listens only on loopback
and simulates the private display-choice API. The test does not start Next.js,
read environment credentials or call Supabase. Browser traffic is restricted
to the fixture origin; no traces, screenshots, names or payloads are logged.

## Scope contract

Goal: exercise the existing post-admission guest name/Anonymous UI in a real
browser. The owning layer is web QA. The runner and simulated ledger fixture,
this document and one existing Chromium CI step are the entire change.
Application behavior, admission, scoring, SQL, nickname policy, production
feature flags and hosted acceptance are excluded. Stop rather than adding
credentials or a public application fixture route to make this test work.

At 390px and desktop widths, the runner verifies:

- Named and Anonymous choices, exact request fields, escaped plain-text names,
  immutable saved state and read-only recovery after a page reload.
- Another tab's simulated winning Anonymous choice takes precedence over the
  local losing name when POST returns `existing`.
- A lost POST response triggers authoritative readback; the UI confirms the
  committed simulated name rather than asking for another write. Chromium may
  retransmit the identical POST after the fixture drops a reused socket; the
  runner checks every received choice is identical and reload adds no writes.
- Whitespace input produces a validation error without a write; the native
  input enforces the existing 32 UTF-16-unit limit.
- A failed initial read offers an explicit loading retry; a failed write with
  no stored choice retains the draft and reports failure after readback.
- No uncaught browser exception or unexpected simulated HTTP payload.

## Execution

Install the repository's frozen dependencies and an external QA-only
Playwright 1.56.1 plus its matching Chromium, as normal CI already does. No
canonical baseball data or full Next build is needed for this runner alone.

```sh
CUSTOM_DISPLAY_QA_PLAYWRIGHT_MODULE=/tmp/ib-default-off-smoke/node_modules/playwright/index.mjs \
  node apps/web/scripts/qa-custom-completion-display-browser.mjs
```

An absolute `CUSTOM_DISPLAY_QA_CHROMIUM_EXECUTABLE` may select a locally
installed Chromium. Both module and executable paths are explicitly supplied;
the runner does not search for credentials or remote browser endpoints.

## Evidence limits

This is mounted-component and browser-transport acceptance against a simulated
API, not signed-cookie authorization, actual concurrent SQL, creator exclusion,
server CSRF, hosted Next ingress, real account providers or Safari/Android.
Existing server/SQL tests and release gates remain required. It grants no
production migration or feature-activation approval. A successful bundle or
syntax check does not establish browser execution: require the runner's final
14-scenario PASS from the exact CI head.
