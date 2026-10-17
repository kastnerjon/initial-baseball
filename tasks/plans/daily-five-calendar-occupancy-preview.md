# Daily Five — authenticated read-only shared-calendar occupancy preview

Status: Staged read-only visibility. No change to the Daily Nine horizon or Daily Five write gate.

## Scope contract
- **Goal:** Allow an authorized future Daily Five editor to identify whether a date is occupied by contract-1 nine-player or contract-2 five-player editorial inventory without decoding it through the legacy nine-only repository.
- **Owning layer:** apps/web Supabase/calendar administration boundary.
- **In scope:** minimal read-only metadata adapter for daily editorial date occupancy; Basic-auth guarded no-store GET; editor date preview and fail-closed Save state on unknown/occupied dates; focused tests; canonical documentation.
- **Out of scope:** Daily Nine horizon read/generation changes, actual five writes, edits, publication, archival, issuer, gameplay, historical puzzle mutation, schema changes, feature-flag activation.
- **Acceptance:** Contract 1/2 both distinguishable; unknown versions/statuses and query errors fail closed; no selections, IDs, clue or player answers returned; authenticated read route, no-store and date validation; focused tests/typecheck, independent review, exact-head CI and READY Preview.
- **Stop conditions:** Any need for schema migration, disabling legacy generation, treating this nontransactional check as write authorization, or enabling the existing Daily Five write gate.

## Coexistence warning
The read-only occupancy check is advisory and may be stale by the time an editor saves. The database unique date constraint is the actual final conflict guard. The legacy nine-only horizon still cannot process a contract-2 editorial row, so Daily Five draft writes must remain OFF until version-aware calendar orchestration and issuance are separately implemented and reviewed.
