# Custom Lineup v2 private incorrect-guess CAS

Status: staged Web-only service (October 14, 2026).

## Scope contract
- Goal: commit only the first and second wrong guess for the active v2 batter, with exactly one durable signed strike/revision transition.
- Owner: apps/web private server service, using existing Daily runtime and v2 repository CAS.
- In scope: immutable-N and challenge-scoped cookie checks, v2 token domain, exact durable revision/history, canonical player ID input, stale/concurrent conflicts, terminal-pending responses, N=1/5/9/10 tests and documentation.
- Out of scope: third-strike append, correct-answer or give-up terminal transition, next batter, restoration, HTTP/UI, comparison, admission, migration and v1/Daily/Classic/Archive changes.
- Acceptance: two signed strikes, no third mutation, no answer oracle disclosure, concurrency one winner, creator/tamper/foreign token rejection, exact-head CI, READY preview, independent review.
- Stop: if safe transition requires terminal admission or new persistence model, split it into the next PR.

## Architecture
Reuses the v2 hint-only token+revision CAS for nonterminal strikes because it changes exactly the same two persisted fields. Shares the previous-history integrity validator with v2 hints. The immutable frozen challenge remains server-side. No public API and no new database schema.
