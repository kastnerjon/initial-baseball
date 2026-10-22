# Custom v2 first-open cookie continuity (#470)

## Scope contract
- Goal: prevent cooperative same-browser first opens from replacing an established challenge attempt with a late anonymous bootstrap cookie.
- Owning layer: existing Custom v2 browser HTTP transport and its mounted React consumer.
- In scope: controlled local real-browser HTTP reproduction with production bootstrap/service code and an in-memory repository; narrow challenge-scoped coordination; deterministic and real-browser regressions; unsupported-browser recovery messaging; exact-head CI/Preview and independent review.
- Out of scope: server identity redesign, database/schema changes, unique-human claims, scoring/CAS/token changes, creator/owner semantics, Daily/Archive/Classic, public activation, WAF and QA credential acquisition.
- Acceptance: delayed two-tab first opens, StrictMode, refresh, hints/guess continuation and completion; assert cookie stability and attempt-row identity; focused tests/typecheck/full checks, exact-head CI/Preview and independent review.
- Stop: any need for new server identity/persistence authority or an unproven browser fallback must be separately decided and recorded. Do not claim isolated hosted QA without its credentials.

## Architecture decision (investigation in progress)
Server cannot distinguish two missing-cookie requests without introducing another identity. Investigate browser-native exclusive Web Locks around the complete bootstrap HTTP exchange; do not substitute BroadcastChannel election or localStorage read/write for an atomic lock. Preserve existing server-signed HttpOnly cookie and server authority. Test page termination/reload because locks end when a document unloads. Unsupported coordination must fail before sending an unsafe first-open request.

## Investigation checkpoint — October 22

Chromium 149.0.7827.0, mounted actual CustomLineupGame at 390×844, actual HTTP handler/bootstrap/hint/guess services, signed tokens, test-only in-memory CAS repository. Held first bootstrap headers; second tab opened, revealed one clue and submitted one wrong guess; released first response. Browser cookie changed to the delayed response's credential. Reload of progressed tab showed zero clues/strikes. Both rows remained, revisions 0 and 2. This is observed visible continuity loss, not merely an inferred race. No QA/production database was contacted. The browser fixture never accepts a remote target URL.

Reproduce with externally installed Playwright and Chromium (no new app dependency):

```sh
cd apps/web
CUSTOM_FIRST_OPEN_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CUSTOM_FIRST_OPEN_CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
node node_modules/vitest/vitest.mjs run app/customLineupFirstOpen.browser.test.ts
```

The negative control deliberately replaces Web Locks with immediate callbacks in the test browser only, retaining a reproducible pre-fix failure after implementation. Current result: 1/1 browser test passed; web typecheck passed. Refresh while a lock holder unloads, StrictMode, completion, and fixed behavior still need verification.
