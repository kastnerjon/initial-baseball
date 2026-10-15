# Custom Lineup v2 private completed-result admission

Status: PR #413 implementation scope (October 15, 2026). No public route or competition activation.

## Scope contract
- **Goal:** authorize a single immutable N=1–10 completed first attempt and admit its authoritative scored result/each at-bat atomically to existing v2 populations, with exact idempotent retries.
- **Owner:** `apps/web` private completed admission service and Supabase RPC adapter.
- **In scope:** challenge-scoped v2 credential and creator exclusion; immutable issued challenge and N; signed completed v2 progression/ledger history check including revision; server-derived points-v4 award per fact, 4*N summary; installed v2 atomic RPC; fail-closed result identity; adversarial N=1/5/9/10, invalid credential/replay/tampered ledger/score tests; handoff.
- **Out of scope:** new SQL migration or schema, public HTTP route, player UI, discovery, noncreator analytics reader, rewards, legacy v1/Daily/Classic scoring and submission validator changes, Daily Five cutover.
- **Acceptance:** service sends no client-controlled score, answer, token or terminal facts to RPC; exact N awards from engine; database independently enforces immutable N, score, row identity and same-attempt transactional retry. Exact-head checks and READY preview, bounded fresh-eyes review, post-merge verification.
- **Stop:** any new schema, auth model, route activation or scoring rule requires a separate scoped PR.

## Architecture
Reuse `validCustomLineupV2SavedHistory` and the v2 HMAC progression domain to verify a complete immutable ledger. Reuse portable `normalizeDailyTerminalAtBat`, `getDailyAtBatPoints`, `applyDailyOutcomeForRuleset`, and `createDailyPointsSummary` for exactly N. The legacy `validateDailyCompletedResult` deliberately rejects N other than nine; don't expand it as part of this private v2-only server bridge. The new Web adapter calls the already-hosted, service-role-only `admit_custom_lineup_v2_completed_attempt` RPC; no duplicate insert logic, extra tables, or data-exposing response. The RPC locks the saved attempt and atomically writes full-game and all N per-AB rows (or returns an exact existing result).

## Review focus
Security boundary: creator/invalid/foreign cookies, cross-domain signed tokens, revision/tampered history, N mismatches, arbitrary player IDs, duplicate and concurrent retries, SQL error redaction, no public API activation, no change to nine-player Daily/Classic/v1.

## Next
Player-facing v2 API/UI and controlled abuse/privacy launch, keeping comparison and publication/read activation separate.
