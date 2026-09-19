# Resolved-at-bat R2 — gameplay request lifetime

Status: implemented; verification pending on the repair PR  
Date: 2026-09-19

## Scope contract

- **Goal:** Reset, durable restore, session replacement, ownership loss or unmount cannot let an older Guess/Give Up response mutate the current game or clear a newer request.
- **Owning layer:** `apps/web` gameplay request transport/composition.
- **In scope:** extract a small request-lifetime controller; enforce synchronous single-flight; identity-check success, failure and cleanup; invalidate on Reset, restore, semantic session change, coordinated Daily ownership loss and unmount; add deterministic delayed success/failure/new-request regressions; reconcile architecture/handoff/todo.
- **Out of scope:** engine/scoring behavior, resolved-AB outbox delivery (R1), shared-save authorization/journal degradation (R3), re-bootstrap persistence authority (R4), request cancellation as a correctness requirement, new test dependencies, schema/provider/API changes, comparison reads/UI.
- **Acceptance checks:** a stale success returns no payload to gameplay handlers; a stale failure shows no error; stale cleanup cannot clear a newer pending request; a second same-lifetime request is rejected synchronously; current failures still report/clean up; both Daily Nine and Classic use the shared guarded component path; repository CI/typecheck/test/file-size/build gates pass.
- **Stop conditions:** any game-rule change, new runtime/test dependency, persistence/storage-format change, or need to redesign ownership authority.

## Implementation

`dailyGameplayRequestController` owns one active request token at a time. `begin()` is synchronous, so two actions cannot both pass before React rerenders. `invalidate()` advances the lifetime and releases the local single-flight gate. Success, error and cleanup callbacks act only when their token is still current.

`DailyInningGame` routes Guess/Give Up transport through the controller. Reset, durable restore, semantic puzzle/ruleset/bootstrap identity changes, coordinated Daily ownership loss and unmount invalidate the current token. A stale network operation may still finish physically, but it cannot return a response into gameplay state, surface an error, or clear a newer request's pending UI.

The same component serves Daily Nine and Classic, so this request-lifetime policy applies to both without moving any game rule out of the engine.

## Test boundary

The repository has no DOM renderer, jsdom, Testing Library or react-test-renderer. Adding one would introduce a new external dependency and cross the repository's decomposition rule. This PR therefore extracts the async correctness boundary into a pure controller and tests the exact delayed-success, delayed-failure, newer-request and synchronous-single-flight interleavings there. R3/R4 remain the owners of the separate persistence/effect-ordering integration concern.
