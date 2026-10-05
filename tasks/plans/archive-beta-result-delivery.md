# Archive-beta result delivery

Status: merged; production deployment verified on 2026-10-05. Fresh native hosted-delivery QA remains unverified.

## Scope contract

- **Goal:** archived Daily Nine plays can deliver the existing immutable at-bat and completed-game result records under the exact issued archive puzzle ID and exact played ruleset.
- **Owning layer:** `apps/web` result transport and server composition. Portable validation and scoring remain in the existing engine; atomic persistence and exact-population identity remain in the existing Daily services/repositories.
- **In scope:** resolve an archive result submission through the existing authoritative archive-beta reader; reject puzzle ID/date/ruleset mismatches before persistence; enable the existing browser journal/outbox and completed-result client for archive games; update the archive listing copy so it describes the still-disabled comparison averages accurately; preserve the current Daily behavior and exact identity. No new table or migration is expected.
- **Out of scope:** comparison reads or presentation, local archive history, replay policy, cross-device identity, Classic archive, permanent archive launch epoch, issuance, scoring changes, new retention or rate-limit infrastructure.
- **Acceptance checks:** focused server submission tests prove authoritative archive resolution and reject forged/mismatched identities; lifecycle tests prove archive observations and completion use the existing owner-gated durable delivery path; current-Daily identity behavior stays unchanged; existing engine-derived facts and spoiler protections remain intact. Run web tests, typecheck, lint, file-size, documentation checks, and production build/hidden-answer scan as repository gates.
- **Stop conditions:** any need for a schema/privilege change, result-contract change, new owner/session mechanism, changed scoring, more than 12 handwritten source/test files or roughly 600 net handwritten lines, or any population key broader than exact puzzle ID + ruleset. Record the finding and split before expanding scope.

## Architecture check

1. Web result delivery is owned by `apps/web`; validation and score derivation stay engine-owned, and persistence remains behind current repository ports.
2. Immutable at-bat and completed-result submission services, clients, and Supabase repositories already exist and include puzzle ID/date/number and ruleset in their identities.
3. The web composition may depend on the existing Daily runtime, archive-beta runtime, engine validators, and Daily repositories. No portable package gains web, browser, or database dependencies.
4. React submits immutable gameplay facts but does not define scoring or population membership.
5. Result transport is platform-specific; scoring/validation remains portable.
6. This activates archive writes into the existing anonymous aggregate result stores. It does not change their schema or identity contract.
7. Update the approved product sequence and handoff to distinguish result delivery from the following comparison-read integration. The product rule is already settled: exact immutable puzzle plus exact played ruleset.

## Follow-up boundary

Comparison reads and UI activation are a separate next PR. Their requests must include explicit puzzle identity and bind it server-side to the authoritative Daily or issued archive puzzle, so same-date populations cannot mix. Browser/device archive history follows separately and still needs an explicit first-result/replay policy.

## Verified release checkpoint — 2026-10-05

Final head `c0ff2ebfd4d2f7057d230a3ef7a5a36f1226ea0a` passed CI #1034 attempt 3 (37368540871), the bounded fresh-eyes review, and READY Preview `dpl_DnxZGkqyCs6HH9DdhdgT3UyQqZ5M`. Earlier review findings were fixed: archive beta accepts only its playable points-v4 ruleset, while current Daily retains historical v3 compatibility; handoff/task wording records implemented delivery. Both threads are resolved.

#300 merged as `c5c2b6fcde1084fa491838cbd492f17a298d6999`; push CI #1035 (37380378865) passed on that merge. At that verification checkpoint, production `dpl_AWxxmLLZTBbReoidx37B7dv2fh4h` was READY and canonically aliased. `/`, `/archive`, `/archive/1` returned 200; `/archive/2` and `/archive/999999` returned 404. The exact-deployment error/fatal 30m scan at 22:10 UTC, after more than 60 seconds READY, found no logs.

Read-only Supabase preserved one archive-beta issued row and zero permanent rows, issued_at `2026-10-05T01:39:24.760Z`, and content fingerprint `bfb08ff7892362e0762d858aa3920d53`. Existing result counts remained 531 at-bats and 56 completed games, with zero archive-beta rows. No migration or hosted result write was performed by this verification pass. Local verification passed 35 focused tests, 688 web tests across 100 files, typecheck, file-size and whitespace checks; hosted CI additionally passed the full repository tests, strict data pipeline and production build.

The original CI attempt was cancelled before test steps ran. Attempt 2 hit a 5-second timeout in the unchanged full-player required-field test; the identical code passed on attempt 3. Investigation is recorded separately in #301; no quality gate was changed.

Verification limits: earlier cloud Chrome gameplay evidence remains valid for the playable archive, but this release's GET/read-only checks do not prove a fresh native hosted result submission. Keep that delivery check and physical/mobile/admin QA open before broad launch; #294 remains open for authenticated admin/mobile QA. Continuous monitoring/drains remain unverified. Archive comparisons and local history are separate upcoming work.
