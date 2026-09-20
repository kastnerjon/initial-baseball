# Daily save decoding hardening

Status: Implemented on bounded R6 follow-up; awaiting review/merge
Date: 2026-09-20

## Scope contract

Goal: make browser-local Daily gameplay save corruption degrade safely instead of throwing during bootstrap.
Owning layer: web persistence decoding.
In scope: classify saved-state reads as missing/unreadable/unusable/loaded, validate the nested structures consumed by compatibility normalization, isolate decode/normalization from the storage adapter, preserve existing valid/legacy behavior, and add deterministic malformed-save regressions.
Out of scope: storage schema migration, reconstructing resolved-at-bat observations, changing completion eligibility, retry policy, analytics/telemetry, comparison behavior, Supabase, scoring, UI redesign, or new browser-test dependencies.
Acceptance: malformed JSON, storage read failure, missing share result, malformed pitch lines, missing submitted result and malformed pending advance never throw; valid saves still load; existing Daily storage tests and full CI/build/hidden-answer QA remain green.
Stop condition: if compatibility fixtures fail because a historical valid shape is rejected, refine the decoder for that documented shape rather than weakening corruption handling globally.

## Architecture

`dailyLocalStorage.ts` remains the browser storage adapter: keying, read/write/remove failure containment and public load/save functions.

`dailySavedGameCodec.ts` owns untrusted persisted-state compatibility decoding and normalization. It validates the structures normalization dereferences, preserves existing legacy outcome/ruleset migration behavior, and contains a final no-throw boundary because local storage is untrusted input.

The public load result distinguishes:
- missing: no value exists;
- unreadable: storage access or JSON decoding failed;
- unusable: JSON exists but cannot safely represent this puzzle/save contract;
- loaded: normalized save plus completed-at-bat provenance.

Existing callers that expect nullable saves keep their contract and map all non-loaded states to null.

## Second-order effects

This keeps malformed local data from crashing Daily or Classic bootstrap because both use the shared Daily persistence path. It does not delete the bad value automatically, so a future observability/recovery policy can distinguish persistent corruption from absence without silently mutating user storage.

The decoder remains browser-local and does not grant contribution eligibility or reconstruct analytics facts. A rejected save therefore cannot manufacture resolved-at-bat rows or a completed result.

## Verification

Focused tests cover the status boundary and concrete nested-shape failures from R6. Full CI and the production package build remain required before merge. Because runtime behavior is only the failure path for local corruption, no Supabase migration or hosted database verification is applicable.

## Documentation impact

Reconcile the September 19 architecture review, current todo and START-HERE so R6 is marked repaired while R5, R7 and R8 remain separate follow-ups.
