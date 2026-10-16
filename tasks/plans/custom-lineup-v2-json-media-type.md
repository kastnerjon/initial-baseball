# Custom Lineup v2 — JSON-only signed mutation media type

Status: bounded server-HTTP protocol hardening; **Custom Lineup gameplay remains default OFF**.

## Scope contract
- **Goal:** reject `hint` and `resolve` POST requests with non-JSON or absent Content-Type *before* parsing the bounded stream or invoking an attempt service, while preserving valid v2 browser requests.
- **Owning layer:** `apps/web` Custom v2 gameplay HTTP adapter.
- **In scope:** media type check exactly at the shared JSON read boundary, targeted HTTP tests of rejected text/plain, form-url-encoded and vendor-JSON media types, accepted `application/json` with optional charset parameter, and canonical docs reconciliation.
- **Out of scope:** legacy Custom Nine v1, Daily/Classic, scoring, hints, database/RPC, new auth/CSRF mechanism, content negotiation, browser UI, rate limiting, publication/discovery, feature activation, and live hosted gameplay E2E.
- **Acceptance:** non-`application/json` hint/resolve requests return private HTTP 400 `invalid_request` before service calls, exact `application/json` and `application/json; charset=UTF-8` maintain behavior, bodyless bootstrap/submit unaffected, disabled flag still 404 before request inspection, exact-head CI/Preview READY and independent review, main/production/routes/logs/Supabase/open-PR postmerge verification.
- **Stop conditions:** need to relax/change browser wire protocol, mutate persistence/identity, add an IP/credential limiter or activate production is separate work.

## Boundary and compatibility analysis
The v2 browser transport already sets `Content-Type: application/json` on both JSON actions and sends no body or type for bootstrap/submit. The v2 server currently passes any 4 KiB JSON-shaped body to `readCustomNineJsonBody` regardless of media type. This single, API-only validation precedes the existing decoder and signed ledger CAS. Only v2 is changed; legacy v1 remains untouched. No dependency or new abstraction. Requiring JSON content type is basic protocol consistency and defense-in-depth; the existing exact-Origin check remains the primary cross-site mutation boundary.

## Release caveat
Neither this PR nor predecessor #423 is real per-IP/per-credential throttling. There are currently zero hosted v2 issued, attempt, completed, and per-AB rows; full hosted E2E for lengths 1, 5, 9, 10 and mobile/abuse/privacy QA remain required before enabling Custom v2.
