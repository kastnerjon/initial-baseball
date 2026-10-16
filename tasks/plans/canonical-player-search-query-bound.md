# Canonical player search — bounded request input before data lookup

Status: Web API pre-release abuse resilience; no gameplay activation.

## Scope contract
- **Goal:** prevent oversized public search terms from triggering canonical player dataset materialization and engine search work.
- **Owning layer:** `apps/web/app/api/players/search`, the shared Daily and future Custom search endpoint.
- **In scope:** cap the *trimmed* search query at the staged Custom gameplay client's existing 100-character ceiling, short circuit empty/overlong requests before `getCanonicalSearchCandidates()`, preserve JSON response contract and regular search; focused HTTP handler tests; canonical handoff updates.
- **Out of scope:** search algorithm, canonical dataset, aliases/initial matching, HTTP rate limits, fingerprints/identity, requests-per-IP/credential, game mechanics, new libraries, Custom flag/public activation, Daily/Classic scoring and search presentation.
- **Acceptance:** empty, whitespace and >100-character queries return HTTP 200 `{ results: [] }` without invoking canonical candidate lookup or search; trimmed standard/100-character terms flow through unchanged; no new public data surface; exact-head CI, Vercel Preview READY, bounded independent review, then main production verification.
- **Stop:** stronger anti-abuse controls, 429/caching policy, auth or API pagination demand separate product/security review.

## Architectural note
The Next.js route already validates empty searches before reading the canonical data. Extending that guard to oversized inputs is the narrowest layer; it neither duplicates portable baseball search algorithms nor adds an abstraction. The existing Custom gameplay UI already caps typed queries at 100, so this makes the same upper bound effective for direct HTTP requests. A public caller can still send many 100-character queries: **this is not a per-client rate limit, bot defense or launch clearance**.

## Release sequence
After this PR, keep gameplay flag off while running real hosted 1/5/9/10 challenge creation/attempt/completed integration in an isolated environment, physical mobile QA and explicit abuse/privacy/rate-limit release review. No public activation, sharing, discovery or leaderboard in this PR.
