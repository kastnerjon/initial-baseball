# Custom Lineup v2 private atomic guess + terminal CAS

Status: revised in PR #411 after independent P1 review (October 14, 2026).

## Scope contract
- Goal: authorize every guess (including correct, third strike, and give-up) via exactly one durable signed CAS transition; no concurrent answer oracle.
- Owner: apps/web private server composition and existing v2 Supabase ledger adapter. Pure evaluation remains in the existing Daily runtime/engine.
- In scope: v2 browser/creator checks, immutable N, signed saved-state history, canonical IDs, first/second wrong guess CAS, terminal fact append/next-batter and exact-N completion, redacted hints, stale/concurrent mixed-guess adversarial tests, docs.
- Out of scope: HTTP exposure, responsive UI, persisted restore, atomic competition result admission, leaderboard, migrations, v1/Daily/Classic/Archive rules.
- Acceptance: all branches win the same revision CAS before returning a distinguishable result; one winner across mixed candidate fanout; no failed-CAS answer; N=1/5/9/10, replay, history, completed N, creator exclusion; exact-head CI, READY preview, review, merge verification.
- Stop: new schema or result-admission semantics go to separate PRs. No public consumer before abuse/privacy review.

## Architecture and review disposition
Independent review of original nonterminal-only PR identified a P1 concurrent answer oracle: correct guesses returned terminal_pending without CAS, while incorrect guesses consumed strikes. Terminal and nonterminal guess authority cannot be split safely. Revised scope joins both branches behind one persisted revision/token predicate, using existing repository CAS and Daily runtime. No new data store, route or rules. Web owns auth and persistence, engine owns outcomes. No Custom v2 external client yet.

## Next
Persisted restoration; atomic completed-game population admission; player UI; controlled release.
