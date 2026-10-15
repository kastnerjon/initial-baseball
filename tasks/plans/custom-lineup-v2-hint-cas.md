# Custom Lineup v2 private signed hint CAS

Status: bounded Web server-side implementation, October 14, 2026.

## Scope contract
- Goal: Reveal exactly one signed, immutable current-batter clue only when the v2 challenge-scoped browser holds the saved attempt's current token; atomically advance the ledger revision and token.
- Owning layer: apps/web private service + Supabase adapter; reuse the existing Daily runtime clue/signing logic.
- In scope: v2 creator/attempt cookie authorization, immutable-N challenge lookup, prior saved-state and signed progression consistency, hint-only conditional UPDATE, stale/concurrent retry rejection, no-answer-leak response, focused tests and handoff/todo.
- Out of scope: public API, creator UI, guessing, give-up, terminal transitions, completed admission/comparisons, resume after progress, SQL migrations and v1/Daily/Classic/Archive changes.
- Acceptance: immutable N=1/5/9/10, ordered 4 hints, replay and concurrent winner, tampered/missing/creator/foreign credentials, v1/Daily token isolation, corrupt ledger rejection, no unrevealed or future hints/answers, green exact-head CI, READY preview, one independent review.
- Stop: additional client authority, migration or account/competition scope must be a separate PR.

## Architecture
All private state mutation uses a revision + prior signed-token CAS; the v2 repository exposes a hint-only operation rather than v1's nine-terminal advance. The runtime reconstructs only the immutable challenge in the server process, then releases exactly the next clue after successful CAS. Bootstrap intentionally stays fail-closed (`continuation_pending`) for progressed attempts until a separate restoration PR. No routes or new provider operations are activated.
