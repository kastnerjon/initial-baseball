# Custom Lineup v2 private saved-attempt continuation

Status: private-only restoration implementation; no public route or competition activation (October 15, 2026).

## Scope contract
- **Goal:** an existing challenge-scoped browser credential can reopen its exact saved active or completed v2 first attempt; refresh never resets at-bats, strikes or previously revealed hints.
- **Owner:** `apps/web` private server attempt bootstrap, sharing the server-monotonic v2 saved-history validator.
- **In scope:** signed immutable v2 token and exact ledger revision checks; creator exclusion; browser credential and challenge provenance; frozen immutable N (1–10); reconstruct only earned current-batter hints; copy prior terminal facts; read-only completed attempt projection without live token; tests and canonical handoff.
- **Out of scope:** anonymous HTTP entrypoint, UI, competition result admission/scoreboard, reset/delete, new Supabase schema, Daily/Classic/Custom Nine v1 changes, future hint or answer reveal.
- **Acceptance:** N=1/5/9/10 first/open/refresh; active saved 0–4 hint depth, 0–2 strikes, previous terminal facts, N completion; no future hints or checkpoint tokens; no ID/answer leakage; creator/foreign/tampered state denied; no new row on restoration; exact-head CI + READY preview + one independent review; post-merge production verification.
- **Stop conditions:** if restoration needs new persistence, answer-bearing client data, public authentication or competition semantics, defer those to dedicated review and release PRs.

## Architecture
This is a **read-only projection** of the authoritative existing `custom_nine_attempt_states` v2 row. The first-attempt reservation path remains unchanged. For progressed or completed rows, the bootstrap privately rereads the immutable issued challenge, revalidates v2-domain signed claims against ledger facts/revision and reconstitutes only hints with slot <= saved reveal depth on the current batter. Completed response carries only saved public per-batter outcomes and timestamp/revision, with no continuation token. No new signing scheme, SQL migration, browser-local authority, network route or engine scoring logic.

## Dependency and portability check
Only the Web private service owns cookies, storage, and redaction. The previous engine terminal-fact normalizer and signed-token codec are reused. Existing portable packages and Daily/Classic/v1 boundaries are unchanged. `validCustomLineupV2SavedHistory` is extended to validate terminal **completed** rows using exactly N facts and no trailing hints/strikes.

## Next
Separately authorize exact-N completed-result admission, then a responsive player-facing API/UI and controlled abuse/privacy release. Custom v2 remains staged until those checks pass.
