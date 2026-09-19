# Daily Nine comparison read routes

Status: scoped for implementation  
Date: 2026-09-19

## Scope contract

- **Goal:** expose the existing Daily Nine comparison service through authoritative, read-only web/server GET routes without adding browser/UI/cache behavior.
- **Owning layer:** `apps/web` server composition and Next.js routes.
- **In scope:** request parsing/validation; points-v3-only routing; future-date rejection; authoritative public-puzzle reload; server-derived puzzle ID/number; lazy composition of the existing Supabase comparison repository + Daily comparison service; live `sourceReadAt`; sanitized no-store HTTP responses; separate at-bat and completed GET routes; focused service/route tests; canonical documentation; preview/production verification.
- **Out of scope:** browser comparison client/retry scheduling, React/UI, sample-size presentation thresholds, cache implementation/TTL/headers beyond explicit no-store, performance benchmarks, rollups/index changes, result-write endpoints, combined write+read responses, R5/R6/R8, Classic comparison.
- **Acceptance checks:** clients cannot choose puzzle ID/number; malformed date/pitch requests fail before provider reads; non-points-v3 rulesets are rejected; future dates fail closed; authoritative puzzle metadata becomes the repository key; at-bat and completed reads remain independent; provider/configuration failures return sanitized comparison-unavailable responses; successful responses carry exact identity + live source freshness; routes are no-store; focused/full CI and exact-head preview pass.
- **Stop conditions:** any need to modify shared transport, Daily comparison semantics, Supabase schema/indexes, result-write acknowledgment, cache infrastructure, browser state, or React becomes a separate PR.

## Architecture decisions

### The URL carries routing inputs, not population authority

The caller supplies only:
- `date`
- `ruleset=points-v3`
- `pitch` for the at-bat endpoint.

The server loads the authoritative public puzzle for that date and derives puzzle ID and puzzle number itself. Client-supplied puzzle identity is intentionally not part of the endpoint contract.

### Separate endpoints preserve independent costs

- `GET /api/daily/comparison/at-bat` reads exactly one resolved-at-bat slot population.
- `GET /api/daily/comparison/completed` reads only completed-game score buckets.

A terminal at-bat never pays for completed-game aggregation.

### No cache policy before measurement

Responses use `Cache-Control: no-store` and `cacheStatus: "live"`. `sourceReadAt` is stamped immediately after the source read completes. The later measured performance/cache PR may introduce shared caching while preserving the shared response contract.

### Read failures never become gameplay/write failures

This PR adds standalone GET routes only. It does not alter `POST /api/daily/at-bats`, `POST /api/daily/results`, or `POST /api/daily/resolve`. A comparison outage therefore cannot change write acknowledgment or gameplay progression semantics.

### Web validates routing; Daily owns comparison math

The web layer validates HTTP routing fields and authoritative puzzle identity. `packages/daily` remains the owner of average/histogram derivation and semantic aggregate validation. Supabase remains the factual aggregate provider.
