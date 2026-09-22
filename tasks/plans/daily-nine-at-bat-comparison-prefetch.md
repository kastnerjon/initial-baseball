# Daily Nine active-at-bat comparison prefetch

Status: implemented
Date: 2026-09-22

## Scope contract

- **Goal:** start the exact Daily Nine per-at-bat comparison read as soon as the hydrated points-v3 at-bat becomes active, keep the comparison completely undisclosed during play, and reuse that same read state at terminal reveal so managed RPC latency is usually hidden behind gameplay.
- **Owning layer:** `apps/web` browser comparison activation/presentation state.
- **In scope:** make the at-bat comparison input carry an exact active-slot key before terminal resolution; separate hidden read state from terminal YOU / AVG presentation state; avoid restarting the read merely because `ownPoints` becomes known; gate active prefetch until saved-game hydration is complete; preserve exact identity fencing on Next/Reset/restore; focused pure/static-render tests; reconcile canonical comparison docs.
- **Out of scope:** shared/API/Daily/engine contracts, Supabase/schema/RPC/index/cache/rollup changes, result-write delivery/retry, persistence-schema changes, historical comparison-snapshot persistence, completed-game comparison, scorecard/share-card AVG, Classic comparison, new dependencies, or mounted DOM test infrastructure.
- **Acceptance checks:** active points-v3 play produces an exact comparison key with no `ownPoints`; Classic/non-hydrated play produces no active read; active read state never renders AVG before terminal; terminal resolution projects the existing in-flight/success/failure read state with engine-derived `ownPoints` and does not trigger a second request solely because points became known; stale slot/session callbacks remain fenced by the existing request controller; Next/Reset/restore remain independent of comparison; focused tests, full CI, file-size/build checks, exact-head Preview and production verification pass.
- **Stop conditions:** if deterministic historical pre-result snapshots across a separately restored terminal page require persistence/API/database changes, stop and leave that as separate product scope; if implementation requires changing comparison population semantics, scoring, result authority, or storage/provider design, stop and split the concern.

## Design

The browser already knows the exact comparison identity before the player resolves an at-bat: stable puzzle ID/date/number + points-v3 + pitch number. The user's awarded points are not known until the terminal engine transition.

The hook therefore owns two different concepts:

1. **Read state** keyed only by the exact active comparison identity. This may be loading, successful, or unavailable while the user is still playing.
2. **Presentation state** derived from read state plus nullable `ownPoints`. While `ownPoints` is null the public comparison state remains `idle`, even if the read has already completed. Once the at-bat resolves, the same read state is projected into the existing terminal YOU / AVG states.

The network effect depends only on exact puzzle/ruleset/pitch identity, not on `ownPoints`. That structural separation is what prevents a second GET when terminal points appear.

Prefetch begins only after saved-game hydration is complete. This avoids firing a pitch-1 read from the initial default React state before a restored session has applied its authoritative current pitch.

Live play normally starts the aggregate read before the current AB result write, which materially reduces the prior terminal race, but request initiation is not an atomic self-exclusion boundary: if the managed read remains in flight while the independent result write lands, the returned aggregate may still include that row. A separately restored terminal state may also perform a fresh current read. This PR does not persist historical comparison snapshots or add exclusion semantics to the API/SQL.

## Implementation

- `createDailyNineAtBatComparisonInput` now activates the exact points-v3 slot before terminal resolution and carries nullable own points separately.
- `useDailyNineAtBatComparison` owns hidden key-scoped read state and projects the existing terminal presentation state only when own points exist. Its request effect intentionally excludes own points from its dependencies.
- `DailyInningGame` gates prefetch on completed saved-game hydration so restored sessions do not briefly request the default initial slot.
- `AtBatCard` still renders comparison only in its terminal branch; static-render coverage explicitly guards against active-state disclosure.
- No shared/API/Daily/engine/Supabase/persistence contract changed.

## Documentation impact

The existing terminal-at-bat comparison plan, resolved-at-bat comparison roadmap, architecture-and-scale plan, START-HERE and todo record hidden active-at-bat prefetch as the current browser policy while preserving asynchronous/non-blocking comparison semantics.
