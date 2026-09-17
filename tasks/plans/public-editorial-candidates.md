# Public editorial candidate resolution

- **Goal:** scheduled/published manual lineups load through the public puzzle source even when a selected player is outside the automatic pool.
- **Owning layer:** `apps/web` server composition. The existing portable Daily editorial candidate factory owns eligibility; reuse it without changing that rule.
- **In scope:** `publicDailyPuzzleSource.ts`, its focused regression test, this scope, `docs/START-HERE.md`, and `tasks/todo.md`.
- **Out of scope:** generator/ranking changes, new persistence or publication behavior, completed-results PR #161, UI changes, new infrastructure, and future lineup contents in public source.
- **Acceptance checks:** scheduled/published exact ordered manual candidates, canonical identities, unavailable-player rejection, missing/draft deterministic fallback, archived rejection; existing candidate/generator tests; full tests, typecheck, lint, file-size check, production build and hidden-answer QA; bounded review and exact-SHA deployment verification.
- **Boundary/duplication:** reuse `createCanonicalDailyEditorialCandidates`, already used by admin composition. No new domain rule or abstraction; database reads remain behind the existing repository port. Automatic selection still receives only ranked automatic players.
- **Stop conditions:** any change to lifecycle, data contracts, authority, automatic eligibility, or another owning layer; unrelated findings remain separate. Preserve the existing draft results PR.
