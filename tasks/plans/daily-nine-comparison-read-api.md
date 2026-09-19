# Daily Nine comparison read API adapters

Status: implemented on PR #201; merge verification pending  
Date: 2026-09-19

## Scope contract

- **Goal:** expose the already-composed Daily Nine comparison reads through thin, sanitized GET adapters while keeping them disabled unless explicitly activated.
- **Owning layer:** `apps/web` HTTP adapters.
- **In scope:** one at-bat GET route; one completed-game GET route; server-only default-off activation flag; shared HTTP error/JSON mapper; query-param extraction; `private, no-store`; focused route/mapper/gate tests; environment example; canonical documentation.
- **Out of scope:** enabling the flag in Preview/Production, browser/client fetching, React/UI, retry policy, cache implementation/TTL/headers beyond no-store, performance/load benchmarking, database/index changes, result-write paths, scoring/domain changes, R5/R6/R8, Classic comparison.
- **Acceptance checks:** flag is false when absent or malformed; disabled routes return before server composition; enabled routes pass only date/ruleset/pitch strings into the authoritative server-read boundary; request errors map to sanitized shared error codes; provider/config/runtime faults never leak internal details; all responses are private/no-store; at-bat/completed endpoints remain independent; exact-head CI/preview pass.
- **Stop conditions:** setting deployment env flags, adding shared cache behavior, introducing browser state, changing shared/Daily semantics, modifying Supabase, or requiring public activation moves to a separate PR.

## Architecture decisions

### Two endpoints preserve two populations

Use separate GET adapters for at-bat and completed comparison. This mirrors the independent repository/service reads and avoids making every terminal at-bat request branch through or pay for completed-game logic.

### Default-off is a server-only availability gate

`DAILY_NINE_COMPARISON_READS_ENABLED` is enabled only by the exact trimmed value `true`. Missing, blank, malformed, and other values remain disabled. It is never `NEXT_PUBLIC_*`.

Disabled routes fail closed before importing/calling the server comparison read functions. This means unbenchmarked reads remain operationally inactive even though the route code is deployed.

### No-store until performance/caching is an explicit decision

All success and error responses use `Cache-Control: private, no-store`. The shared response contract already supports future cached responses, but this PR does not choose a TTL, CDN policy, or cache store.

### Sanitized transport errors only

Request errors preserve only the shared error code. Authoritative puzzle/runtime failures become `invalid_puzzle`; provider/configuration failures become `comparison_unavailable` with 503; unexpected faults become the same sanitized error with 500. Internal exception messages are never returned.

### Activation is a later checkpoint

This PR adds the gate but does not configure it in Vercel. Representative isolated performance evidence is required before a separate production-activation decision.
