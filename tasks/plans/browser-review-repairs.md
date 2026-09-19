# Browser review repair roadmap

Status: R1–R2 implemented; R3/R4 persistence authorization is the next bounded repair; comparison remains deferred.

Preserve engine scoring, immutable transport/storage contracts, separate populations and Classic compatibility. All repairs are web-owned. No new runtime dependency, schema, lease, forced takeover or anti-cheat authority.

## Ordered PR scope contracts

1. **R1 delivery lifetime — implemented.** A released owner cannot start another retry or mutate a journal acknowledgment. Delivery now uses a disposable exact attempt/generation owner session; the persistence hook disposes it synchronously before releasing the Web Lock. Late success/error is locally inert, pending exact payloads remain for successor retry, and takeover/interleaved-append regressions cover the original counterexample. No retry scheduling, gameplay request, schema or persistence-mechanism change.
2. **R2 gameplay requests — implemented.** Reset/restore now invalidates every old Guess/Give Up callback through a small synchronous single-flight request-generation controller in the web layer. Success, error and settled callbacks run only for the current generation; stale cleanup cannot clear a newer pending request. The existing shared Daily/Classic resolve path, request payloads and scoring behavior are unchanged.
3. **R3/R4 persistence authorization.** Goal: only the current ready owner writes shared Daily state even after journal failure/re-bootstrap. In scope: coordinator degradation, explicit hook readiness and mounted lifecycle tests. Out: leases, forced stealing, Classic ownership. Acceptance: corrupt journal with two tabs, generation-write failure, prop changes/StrictMode, current gameplay restoration before save. Stop: product fallback or storage-format change.
4. **R5 delivery recovery.** Goal: finite network requests and bounded owner-scoped retry opportunities. In scope: AB browser transport/scheduler and focused tests. Retry on meaningful events, no polling/tight loop, no historical scan. Out: comparison recovery and infrastructure. Acceptance: failure followed by online/new-terminal opportunity, no duplicate concurrent requests, cleanup cancellation.
5. **R6 save decoding.** Goal: malformed saves return unusable without crashing or creating inferred observations. In scope: storage decoder boundary and fault regressions. Out: compatibility policy, storage schema, completion backfill. Acceptance: malformed nested structures and unchanged supported saves.

R7 modularity is addressed within its owning behavior: request controller, authority/readiness boundary, dedicated delivery scheduling. R8 request admission/observability stays a separate follow-up; do not invent rate-limit infrastructure or silently strengthen anonymous authority. Record concrete acceptance criteria before implementation.

## Verification and publication

Run focused tests per concern and the full applicable suite/typecheck/build once on the completed stack. PRs are explicitly stacked from the documentation review branch to keep each owning diff separate; promote/merge only after its checks and review. Preserve prior phone proof but do not claim new physical-device QA. Each PR updates this plan and canonical handoff/todo.
