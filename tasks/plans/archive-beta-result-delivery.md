# Archive-beta result delivery

Status: implementation checkpoint for the first archive results/comparisons work.

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
