# Prevent initials-only player suggestions

Status: implemented locally; one review and exact-head release checks pending. Release evidence will be recorded in the PR.

## Scope contract

**Goal:** Entering separated initials such as `a r` or `o a` must not turn player autocomplete into a clue lookup.

**Owning layer:** `packages/engine`, existing pure player-search policy shared by canonical and legacy callers.

**In scope:** Reject normalized multi-token queries consisting entirely of single letters before substring/token-prefix matching. Preserve single-fragment searches, meaningful multi-word fragments, aliases, accented/punctuated name search and genuine initial-based names once a name fragment is supplied. Add engine regressions and one public search-route integration check; update product/engine/API/handoff documentation.

**Out of scope:** Scoring/averages, player data/aliases, lineup corrections, result storage, autocomplete layout, new minimum lengths for ordinary names, new dependencies and admin reporting.

**Acceptance:** Both search entry points reject case/spacing/separator variants and three-letter initials. No cross-word substring or alias path bypasses the guard. Normal name fragments, surname-only queries, aliases and `A. J. Reed` remain supported. The existing HTTP route returns empty results for initials. Focused tests, repository CI/build/answer QA, one bounded review, exact-head READY Preview and public endpoint probes, post-merge CI/production/log checks. Physical/mobile interaction QA remains distinct from endpoint behavior proof.

**Stop:** Expanding into a new search-ranking design, data correction, UI policy or another primary owner requires separate scope.

## Architecture check

Existing search normalizes through engine-owned `normalizeGuess` and shares one candidate matcher. A guard there covers canonical HTTP search and legacy consumers without a route/UI-only patch or duplicated policy. No puzzle/answer identity is consulted, so suggestions remain independent of the active answer. No portable dependency or transport shape changes; the server route and existing browser rendering simply receive an empty result set. This is a narrow autocomplete rule change authorized by the reported shortcut; guess evaluation and immutable results are unaffected.
