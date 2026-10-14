# Private Custom Lineup v2 comparison bucket prerequisite

Date: October 14, 2026. Status: reviewed proposal; public Custom still disabled.

## Scope contract
- Goal: two service-role-only points-v4 result-bucket readers for immutable schema-v2 1–10 player challenges.
- Owner: Supabase private SQL read boundary.
- In scope: exact challenge/issued schema isolation; at-bat 1..N; join accepted completed result; half-point scores; optional **trusted server-derived** own-result exclusion; rollback fixture; canonical docs.
- Out of scope: public reads, browser UI, runtime flags, result writes/admission, new indexes/stores, changing historic v1/Daily/Archive/Classic.
- Acceptance: independent exact-head review, green CI, READY Preview; after merge authorized hosted migration, rollback-only tests for 1/5/9/10, peer exclusion, cross-version isolation and grants; production/push CI/main verification.
- Stop: requiring a public/untrusted exclusion, a new auth/store, public activation or game-rule change.

## Architecture
Existing v1 functions are not modified. Versioned v2 functions use SECURITY INVOKER, fixed search_path, existing private tables, immutable issued N and accepted completions. Only service_role may execute. The engine remains scoring authority; SQL groups stored results only.

## Documentation impact
Correct previous stale claims that #401/#403/#404/#405 remain blocked. Record actual hosted migration-version mismatch; preserve separate implementation stages for signed runtime/UI and Custom competition.
