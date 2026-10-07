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

- Goal: let the existing provider return score buckets after optionally excluding one durable anonymous result ID, without exposing the filter publicly yet.
- Owning layer: the server-only Supabase comparison adapter plus additive database read functions.
- In scope: additive uniquely named v2 RPCs; exact puzzle/ruleset/slot filtering; optional attempt/submission-ID exclusion; AB bucket decoding with count/sum derived from persisted engine-derived points; completed buckets; service-role-only execution; focused adapter tests; hosted definition/ACL/readback proof.
- Out of scope: comparison route/query parameters; browser storage/journal reads; Reset behavior; UI thresholds/colors/copy; result creation/delivery; scoring; new tables/indexes/rollups; archive browser activation.
- Compatibility: existing comparison RPCs remain unchanged for rollback safety. The v2 functions are uniquely named rather than overloaded because Supabase RPC guidance does not support overloaded function names.
- Acceptance: null exclusion preserves the full population; a matching exclusion removes only that attempt/submission; v4 half points remain exact; provider returns AB buckets plus count/sum; no SQL rescoring; anon/authenticated cannot execute either v2 function; service_role can.
- Stop conditions: any public/browser identity transport or presentation change moves to PR 3/4.

Hosted migration `20261007165115_add_filtered_daily_nine_comparison_reads` is applied. Readback confirms both v2 functions are SECURITY INVOKER, executable only by service_role among application roles, and a live exact-slot check showed one matching attempt excluded from a one-result population.

## Remaining stages

PR 3 carries the durable first result ID through the private comparison HTTP/browser path while preserving the journal's stable attempt ID across Reset. PR 4 activates one-other-result AVG/BEAT presentation and approved green/red semantics. Production thresholds remain unchanged until PR 4.
