# Custom Nine — headless browser attempt transport

Status: Bounded implementation scope (2026-10-11). Browser transport only, not a playable Custom Nine screen.

## Goal and owner

Provide one reusable, typed `apps/web` browser HTTP boundary for the already-issued Custom Nine server-monotonic attempt routes, so the independent presentation/UI PR can consume a stable interface.

## Scope contract

**In scope:** `createCustomNineBrowserTransport()` methods `bootstrap(challengeId)`, `revealHint(challengeId, signedToken)`, and `resolve(challengeId, signedToken, {submittedPlayerId}|{giveUp:true})`. It explicitly models reserved and creator-preview modes; parses redacted nine-batter lineup, current authorized hints, persisted completed at-bats/current strikes, and server responses; uses challenge-specific POST endpoints and same-origin browser credentials; maps known 4xx/5xx errors to sanitized typed kinds.

**Out of scope:** Visual game UI/UX, page/route rendering, headless state machine, point scoring, retry automation, player lookup, new server APIs, schema/flags/competition changes, customizable hints, or the deferred all-zero-statistics request.

**Acceptance:** No browser-selected attempt ID or locally generated progression token; bodyless bootstrap and bounded exact action JSON; no private future clues in reserved bootstrap; malformed/contradictory successful payload fails closed; handled 409 completed versus conflicting progression; network errors sanitized; creator preview not mistaken for a contributing reserved attempt; focused tests/typecheck, exact-head CI and READY Preview, independent review.

## Protocol and data flow

- `POST /api/custom-nine/challenges/{puzzleId}/attempt/bootstrap`: bodyless; server's challenge-specific HttpOnly cookie reserved on first eligible play or existing ledger resumed. `creator_preview` has **no** contributing `attemptProgress`; callers must not send creator previews through reserved-attempt mutations.
- `POST .../attempt/hint`: sends only current signed progression token, receives one revealed clue and new signed token.
- `POST .../attempt/resolve`: sends signed progression token and one canonical guessed player ID or Give Up; receives either a nonterminal strike or a terminal resolution and optional next-batter authorized clue bundle.
- **Network ambiguity:** A mutation may have committed when its response is lost. UI/controller must re-bootstrap and reconcile authoritative state, not repeat speculative/local state transitions. A stale CAS conflict is not a free retry.
- Terminal ninth at-bat currently completes the ledger and bootstrap returns 409 `attempt_completed`. Showing complete game from persisted receipt is **separate work**; never manufacture completion results locally.
- The server remains source of truth. Existing Daily/Archive clients, competition gating, and Custom legacy stateless routes are unchanged.

## Architecture decision

This is a transport adapter and runtime decoder, not a second rules engine. Reuse `normalizeDailyTerminalAtBat` for already-terminal facts; use shared Daily/Custom transport shapes where suitable. Keep Custom-specific action paths and cookie-scoped authority separate from Daily's local-save and stateless progression. Do not couple any visual component to the Supabase ledger.

## Release evidence

Local focused client tests: 8/8 passed. Web TypeScript check passed. Fill in independent review, exact-head CI, READY Preview, merge and postmerge evidence when available.
