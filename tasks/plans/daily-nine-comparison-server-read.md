# Daily Nine comparison server read composition

Status: implemented on PR #200  
Date: 2026-09-19

## Scope contract

- **Goal:** compose the existing Daily Nine comparison service behind an authoritative server-only read boundary without exposing a public HTTP route.
- **Owning layer:** `apps/web` server composition.
- **In scope:** routing-field validation; points-v3-only reads; future-date rejection; authoritative public-puzzle reload; server-derived puzzle ID/number; lazy composition of the existing Supabase comparison repository + Daily comparison service; conservative live `sourceReadAt`; focused service tests; canonical documentation.
- **Out of scope:** Next.js routes, HTTP status/error mapping, route activation flags, browser fetching/retry, React/UI, cache implementation, performance benchmarking, database/index changes, result-write endpoints, R5/R6/R8, Classic comparison.
- **Acceptance checks:** client-shaped inputs cannot select puzzle ID/number; malformed/future/unsupported requests fail before provider reads; at-bat and completed reads remain independent; authoritative puzzle metadata becomes the repository key; source freshness is captured immediately before provider read; provider failures remain provider failures for the later HTTP adapter to sanitize; full CI/preview pass.
- **Stop conditions:** public route behavior, HTTP mapping, activation control, cache infrastructure, browser state, React, shared-transport changes, Daily semantic changes, or Supabase schema changes move to separate PRs.

## Architecture decisions

### Server derives comparison population identity

The caller-facing shape contains only date/ruleset and, for an at-bat read, pitch. The server reloads the authoritative public puzzle and derives puzzle ID and puzzle number before querying the portable Daily comparison service.

### Web composes; Daily owns math

The web layer validates routing and binds authoritative puzzle identity. `packages/daily` still owns average/histogram derivation and semantic aggregate validation. Supabase still returns factual sufficient statistics only.

### Freshness is conservative

`sourceReadAt` is captured immediately before the provider read begins. This avoids overstating freshness by the query duration and gives a future cache a conservative source timestamp.

### Public HTTP exposure is deliberately separate

This PR creates no route. Thin Next.js adapters, sanitized error mapping, `no-store`, and a default-off production activation gate belong to the next PR. This split keeps #200 below the repository's handwritten-line decomposition threshold.
