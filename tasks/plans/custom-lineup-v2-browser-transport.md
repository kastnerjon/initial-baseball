# Custom Lineup v2 — strict 1–10 browser transport

Status: PR #415, client-only transport preparation (October 15, 2026).

## Scope contract
- **Goal:** typed, strict, headless client that safely consumes the four off-by-default v2 gameplay endpoints for exact immutable N=1–10; no UI or public activation.
- **Owner:** `apps/web` client protocol and decoded DTOs only.
- **In scope:** v2-only ID/URL validation, same-origin POSTs, bodyless bootstrap/submit, signed hint/guess request shapes, redacted active and completed restoration, creator preview, terminal/correct/incorrect responses, exact current-vs-final batter checks, malformed/oversharing payload rejection, generic error mapping, focused tests, canonical handoff.
- **Out of scope:** React components, CSS, new routes, server services, SQL, creator issuance, scoreboards, feature flag enablement, Daily/Classic or v1 transport changes.
- **Acceptance:** tests at N=1/5/9/10 with active and completed progression; no client-authoritative scores, attempts, token advancement or locally revealed future hint slots; all malformed payloads fail closed; disabled/conflict and network errors sanitized; exact-head CI, READY preview, bounded fresh-eyes review, post-merge checks.
- **Stop:** no public game activation, new auth/abuse architecture, DB schema or rule change in this PR.

## Architecture and reuse
- Client transport only sends `/api/custom-lineup/challenges/{v2-id}/attempt/{bootstrap|hint|resolve|submit}` with browser-held HttpOnly credentials via same-origin fetch. No URL construction from a mutable arbitrary route prefix and no client-supplied attempt ID or score. All server progression tokens are opaque.
- Reuse `normalizeDailyTerminalAtBat` to check persisted fact shape and both existing Custom Nine terminal decode/whitelist functions for canonical reveal and terminal outcome. Read-only DTO parsing has distinct v2 length and completed-bootstrap semantics, deliberately leaving v1 nine-only transport alone.
- React and UI styling are deferred to the next bounded PR; server remains feature gated off. No change to portable packages or production configuration.

## Predecessor verification
PR #414 merged as `a2f0c0d6beadf54507326891a251fe59d9691fe3`, exact main CI SUCCESS, Vercel production READY, no runtime errors in checked window, and zero open PRs. Supabase v2 hosted challenge/attempt/completed/per-AB populations all 0. Existing Custom v2 routes are present but default to 404 before service/DB access.
