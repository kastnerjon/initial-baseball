# Custom Lineup browser request lifetime — bounded #472 repair

## Scope contract

- **Goal:** A late response from a superseded Custom Lineup bootstrap, hint, guess, Give Up, completion admission, refresh or different puzzle must never paint obsolete state. Two near-simultaneous actions must not both launch from a stale React busy render.
- **Owning layer:** apps/web browser request/React composition.
- **In scope:** Reuse the existing, tested dailyGameplayRequestController synchronous single-flight/generation authority in CustomLineupGame, key the mounted game session to puzzleId, invalidate on restoration and unmount, and add deterministic delayed-response and competing-action regressions.
- **Out of scope:** No scoring, hints, clue ownership, attempt/cookie issuance, SQL, API protocol, shared package, Supabase, WAF, production activation or #470 first-cookie concurrency changes.
- **Acceptance:** Focused request-controller tests and Custom static-render regression, web typecheck, complete repository test/lint/file-size/doc checks, exact-head CI, READY Preview and independent review before merge.
- **Stop:** If a repair needs new persistence, client/server authorization or a broad new browser framework, make a separate architecture decision.

## Architecture

The existing web-owned createDailyGameplayRequestController already provides synchronous request exclusion, request identity, invalidation across reset and inert obsolete success/error/finally callbacks. Custom reuses that controller directly rather than duplicating a second generation implementation. Restoration always invalidates the current generation before issuing a replacement bootstrap. Each mounted puzzleId receives a keyed React session and a distinct request controller. Completion admission joins the same client single-flight lifetime.

The server's signed tokens, revision CAS, durable first attempt, and immutable answers do not change. A stale HTTP request may still commit server-side; after any competing-tab conflict the browser reopens authoritative progress. The UI guard prevents stale painting, not network delivery or duplicated anonymous browser identity.

## Risk and evidence limits

- #470 remains separate: two cookie-less concurrent server bootstraps may mint different cookies before the browser has established its first attempt; this change does not solve that case.
- The deterministic controller tests prove callback fencing and synchronous request exclusion, not a fully mounted React browser or real cross-tab Set-Cookie order. Complete real-browser acceptance and QA-only creator/friend HTTP remain launch gates.
- No dependency addition or portable package modification; the controller remains a web-layer concern.

## Documentation impact

Update tasks/todo.md to reconcile merged #483 and record the staged #472 repair. This scope plan documents the implementation and residual #470 separately. docs/START-HERE.md should be reconciled with final review and main verification rather than proclaiming release readiness before merge.
