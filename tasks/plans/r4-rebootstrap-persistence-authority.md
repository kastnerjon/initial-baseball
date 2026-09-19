# R4 browser re-bootstrap persistence authority

Status: implemented on this PR; merge verification pending  
Date: 2026-09-19

## Scope contract

- **Goal:** prevent a React render carrying stale owner state from persisting or resetting shared Daily gameplay after that ownership/session has been torn down or replaced.
- **Owning layer:** `apps/web` browser persistence composition.
- **In scope:** stable semantic persistence-session identity; per-session hydration readiness; exact live-vs-render authority checks at save/reset; fail-closed missing-owner refs; deterministic R4 regressions; canonical documentation.
- **Out of scope:** R5 delivery scheduling, R6 save decoding, comparison reads/UI, Classic ownership redesign, leases, storage/schema/server changes, scoring, and new React/DOM test dependencies.
- **Acceptance checks:** equivalent puzzle objects do not re-bootstrap ownership; a true puzzle/ruleset change is non-writable until restored and current; stale owner render cannot save after cleanup; compatibility also requires current readiness; bootstrap-token-only prop changes do not restart ownership; focused/full CI and exact-head Vercel preview pass.
- **Stop conditions:** adding jsdom, Testing Library, react-test-renderer, another runtime dependency, or broader persistence-hook decomposition becomes a separate bounded concern.

## Design

The session key is the stable public puzzle identity plus exact ruleset: puzzle ID/date/number + ruleset. Object identity and the bootstrap token are not ownership identity. This prevents harmless equivalent prop objects or a reissued initial token from releasing and reacquiring the Web Lock.

The hook tracks two live capabilities independently from React's rendered state:

1. the exact active persistence session;
2. whether that exact session has completed durable restore and is ready to write.

A save or reset is admitted only when the render's access/session/readiness and the live refs all describe the same writable session. Cleanup clears live authority before coordinator release. A real new session therefore makes the old rendered owner immediately non-writable, even before React commits the follower/checking update.

The hook also exposes `checking` when rendered props describe a session different from the current live session, preventing a transient old-game/new-puzzle interactive frame.

## Testing limitation

The repository has no jsdom, happy-dom, Testing Library, or react-test-renderer dependency. The operating manual says a new external dependency is a decomposition trigger, and this scope explicitly stops before adding one. The regression suite therefore tests the exact authority predicate and semantic-session behavior deterministically rather than claiming a mounted StrictMode test. Preview/production browser verification remains the integration check. If future React lifecycle work requires a reusable mounted harness, introduce that test infrastructure in its own bounded PR.
