# Daily Nine comparison API transport contract

Status: implemented on this PR; merge verification pending  
Date: 2026-09-19

## Scope contract

- **Goal:** define the portable, versioned HTTP response contract for Daily Nine comparison reads before Next.js routes or browser clients exist.
- **Owning layer:** `packages/shared` transport contracts.
- **In scope:** schema version; exact points-v3 puzzle identity; separate at-bat and completed success shapes; freshness metadata; explicit comparison-read error codes; package export; focused type/shape tests; canonical documentation.
- **Out of scope:** Next.js routes, Supabase/server composition, browser fetching/retries, React/UI, cache implementation/headers/TTL, sample-size thresholds, scoring, database changes, R5/R6/R8.
- **Acceptance checks:** AB and completed populations remain distinct; source freshness survives a future cache; callers can distinguish live vs cached snapshots and unavailable vs malformed/unsupported reads; no user-specific score enters the completed response; CI/preview pass.
- **Stop conditions:** route parsing, server composition, cache implementation, browser retry policy, or presentation logic becomes the next owning PR.

## Design decisions

### Version the comparison transport separately

Comparison responses have their own schema version. They do not inherit the result-submission schema or gameplay ruleset version, so response evolution does not imply a scoring or persistence migration.

### Preserve population identity in every success payload

Each success response carries exact puzzle ID/date/number and `points-v3` ruleset identity. At-bat responses additionally carry the exact pitch number. A later browser client can reject a stale response that arrives after the visible reveal changes.

### Freshness is explicit but caching is not implemented here

Every success response carries `sourceReadAt` and `cacheStatus: live | cached`. A direct provider read will use `live`; a later cache must preserve the original `sourceReadAt`. The contract deliberately avoids a second response timestamp so it works with either application-level or HTTP/CDN caching and does not select a TTL, cache store, or cache header.

### Completed comparison remains user-independent

The completed response contains population count, average and score histogram. It does not accept or echo the current user's score and does not compute a personalized percentile in the HTTP layer. The existing portable Daily strict-lower helper remains the single semantic owner of that calculation.

### Failure is transport-visible, not a gameplay outcome

`comparison_unavailable` is distinct from malformed request, puzzle mismatch and unsupported ruleset. The later browser client can retry comparison reads without coupling them to result-delivery acknowledgments.
