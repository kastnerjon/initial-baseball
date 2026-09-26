# Archive browser save isolation

Status: bounded implementation scope, September 24, 2026.

## Scope contract

- **Goal:** an issued permanent puzzle saves and restores its browser gameplay independently of current Daily, Classic, other permanent puzzles and other scoring versions.
- **Owning layer:** `apps/web` browser persistence.
- **In scope:** map only the generic gameplay save key to an archive namespace selected by permanent puzzle ID and ruleset; preserve existing beta/Classic keys, existing identity-based journal/outbox and owner-lock keys, and exact-version archive restore compatibility. Add focused storage tests and reconcile roadmap documentation.
- **Out of scope:** archive routes, new scoring logic, result submission or comparison policy, permanent issuance, schema changes, launch date and history UI.
- **Acceptance checks:** current-at-that-checkpoint and Classic keys unchanged, archive puzzles/versions do not overwrite each other, resetting one archive key leaves others intact, storage failures remain nonblocking, focused tests, typecheck, full repository gates and exact-head CI/Preview. The later H2 current-Daily v4 namespace is a separate scoped evolution, not a rewrite of archive identity.
- **Stop conditions:** a new result-delivery contract, a new database or public route, or a change to the portable puzzle identity requires a separate PR.

The existing browser session key, owner lock, attempt journal and result outbox already bind puzzle ID/date/ruleset. Their storage keys are intentionally left untouched. Permanent IDs use the `permanent-v1-daily-N` series and receive an `initial-baseball:archive:permanent-v1:<puzzle-id>:<ruleset>:<date>` gameplay-save key. At this archive checkpoint beta Daily kept `initial-baseball:daily:<date>` and beta Classic kept `initial-baseball:daily:classic:<date>`. H2 later preserves that historical Daily key for legacy/v1/v2/v3 compatibility while assigning current-Daily points-v4 the separate `initial-baseball:daily:ruleset:points-v4:<date>` key; archive keys remain unchanged.

Archive scoring is chosen from the current public ruleset **at the start of each new play**. A saved attempt stays under the ruleset with which it began. A later ruleset change starts a separate attempt and comparison population; old scores are retained as historical results under their original version. The archived lineup and issued clues remain fixed. Comparison reads must bind the exact permanent puzzle identity and played ruleset rather than date alone. Route/result wiring for this policy remains a later PR.
