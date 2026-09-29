# Archive-beta authoritative issuance composition

Status: implemented on branch; verification pending

## Scope contract

- **Goal:** compose explicit schema-v2 archive-beta issuance from the authoritative editorial lineup and the exact public clue materialization already used by permanent issuance, without auto-activating an epoch or writing a hosted beta row during this PR.
- **Owning layers:** portable Daily issuance orchestration plus server-only web composition.
- **In scope:** shared editorial eligibility/order validation; archive-beta clue-frozen issuance service over the existing immutable beta repository; server-only archive-beta issuance composition using one service-role Supabase client, authoritative editorial read by the supplied beta identity date, the existing canonical player lookup + Daily pitch/hint materializer, and the beta Supabase issued-puzzle repository; focused permanent-regression and beta tests; canonical docs.
- **Out of scope:** environment/current-date beta epoch derivation, automatic scheduler/cron, HTTP/admin route, writing any production beta row, public archive route/gameplay/results/history, reset/delete tooling, or permanent launch policy.
- **Acceptance checks:** scheduled/published editorial content only; exact slots 1-9; editorial date must equal supplied archive-beta identity date; same current public initials/hints as permanent issuance; missing editorial/player/hint fails before persistence; exact retry preserves first issue time; changed lineup/clues conflict through the immutable beta service; one server Supabase client is reused for editorial read + beta write; permanent issuance behavior remains unchanged.
- **Stop conditions:** actual hosted issuance, activation policy, routes/auth, scheduling, or new storage semantics are separate concerns.

## Architecture decision

The editorial eligibility/order rules are series-neutral. Extract that validation into a small portable helper that receives a series-specific label, then keep permanent and archive-beta issuance facades explicit. This avoids duplicating lifecycle rules while retaining runtime series fencing in the immutable services.

The web clue materializer already produces the same portable clue snapshot used by both series. Add a series-neutral export name while preserving the existing permanent-named export for compatibility. Archive-beta server composition then mirrors the permanent server boundary but injects `createSupabaseArchiveBetaDailyIssuedPuzzleRepository`.

The caller must supply an already-resolved `ArchiveBetaDailyIdentity`. This PR therefore cannot infer or activate a beta epoch by itself and cannot create a row unless explicitly invoked by later operational work.


## Implementation note

The portable beta issuance facade and server-only composition are capability-only. Construction creates providers, but no repository write occurs until a caller explicitly invokes `issue({ identity, issuedAt })` with an already-resolved beta identity. This PR intentionally provides no public/admin invocation surface and does not configure the beta epoch.
