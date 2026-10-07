# AB BEAT and one-other-result comparisons

## Decision and release sequence

The owner requests BEAT after each AB and on the final score with one other result. Green means personal points strictly exceed the average; red means they do not. Ties are not beaten. Counts describe other submitted results, not unique people. Read-only exclusion uses the durable first attempt/submission ID, including after Reset. No result creation/delivery policy changes.

Separate concerns ship from latest main: portable distribution contract, service-only filtered provider reads, browser exclusion transport, then presentation. Archive browser activation remains separate.

## PR 1 — portable distribution contract

Status: complete in #316 and production verified.

- Daily owns exact-version AB/completed histogram normalization and strict-lower rates.
- Shared carries only additive transport identity/histogram fields.
- No database, HTTP, browser-storage, scoring, result-write or UI behavior changed.

## PR 2 — service-only filtered provider reads

Status: complete in #317 and production verified.

- Goal: let the existing provider return score buckets after optionally excluding one durable anonymous result ID, without exposing the filter publicly yet.
- Owning layer: the server-only Supabase comparison adapter plus additive database read functions.
- In scope: additive uniquely named v2 RPCs; exact puzzle/ruleset/slot filtering; optional attempt/submission-ID exclusion; AB bucket decoding with count/sum derived from persisted engine-derived points; completed buckets; service-role-only execution; focused adapter tests; hosted definition/ACL/readback proof.
- Out of scope: comparison route/query parameters; browser storage/journal reads; Reset behavior; UI thresholds/colors/copy; result creation/delivery; scoring; new tables/indexes/rollups; archive browser activation.
- Compatibility: existing comparison RPCs remain unchanged for rollback safety. The v2 functions are uniquely named rather than overloaded because Supabase RPC guidance does not support overloaded function names.
- Acceptance: null exclusion preserves the full population; a matching exclusion removes only that attempt/submission; v4 half points remain exact; provider returns AB buckets plus count/sum; no SQL rescoring; anon/authenticated cannot execute either v2 function; service_role can.
- Stop conditions: any public/browser identity transport or presentation change moves to PR 3/4.

Hosted migration `20261007165115_add_filtered_daily_nine_comparison_reads` is applied. Readback confirms both v2 functions are SECURITY INVOKER, executable only by service_role among application roles, and a live exact-slot check showed one matching attempt excluded from a one-result population.

## PR 3 — durable browser exclusion transport

Status: implemented by PR #318; exact release evidence is recorded in the PR and post-merge checkpoint.

- Goal: carry the first durable anonymous result ID from the existing browser persistence authority through both comparison GET paths so current-Daily reads exclude the user's own first submitted result, including after local Reset.
- Owning layer: `apps/web` persistence/HTTP/browser comparison adapters. Daily continues to own comparison math; the #317 Supabase provider remains unchanged.
- In scope: read-only durable attempt-ID access from the existing journal lifecycle; current-Daily AB/completed request keys; optional `excludeResultId` query transport; strict anonymous-ID validation; response identity echo/verification; request/cache fencing by exclusion identity; focused Reset/transport tests.
- Out of scope: scoring, result creation/delivery, contribution rules, database functions/schema, archive comparison activation, sample thresholds, AVG/BEAT copy, colors and layout.
- Security semantics: the token is an opaque anonymous read filter, not authentication or account authority. Responses remain `private, no-store`.
- Reset invariant: Reset may retire future contribution, but it does not erase the journal's durable first `attemptId`; comparison reads continue excluding that same ID.
- Stop conditions: any presentation-policy or archive activation work moves to the next separate PR.

## PR 4 — one-other-result presentation

Status: implemented by the final current-Daily presentation activation; exact merge/deployment evidence belongs in the PR release checkpoint.

- One other valid submitted result is enough for per-AB and completed-game AVG/BEAT.
- BEAT is the Daily-owned strict-lower distribution rate; ties stay in the denominator and are not beaten.
- Green means personal points are strictly above arithmetic AVG. Red means personal points are equal to or below AVG.
- Explicit "Above AVG" / "At or below AVG" text accompanies color so color is not the only status signal.
- Zero-other-result populations remain withheld and may take the existing one bounded completed-slot retry; one-other-result populations no longer retry merely to cross an obsolete sample threshold.
- Gameplay/result-write/scoring semantics are unchanged and comparison remains asynchronous/nonblocking.
- Archive browser comparison activation remains separate and next.
