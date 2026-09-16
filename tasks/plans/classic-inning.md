# Classic Inning: versioned rules and isolated public mode

Status: Approved direction; portable rules merged in PR #141; web transport implementation is in progress September 16, 2026.

## Product decision

Daily Nine remains the default `points-v3` game (nine at-bats, 63 maximum). The prior `points-v2` contract remains compatible for existing sessions. Classic Inning uses a new `classic-inning-v1`: the same ordered daily nine, existing runner advancement and runs, immediate completion at the third out or after batter nine. Three wrong guesses or Give Up is one out. There is no repeat batting or extra lineup generation. Unplayed answers remain hidden. Players can play both modes on one date, accepting the known spoiler interaction of a shared lineup. Existing `legacy-inning-v1`, `points-v1`, and `points-v2` sessions retain their rules.

## PR A: portable rules contract

- **Goal:** derive Classic outcomes/completion and mode-labelled sharing under an intentional new identifier.
- **Owning layer:** `packages/engine`; minimal shared version/type declarations support that owner.
- **In scope:** explicit Classic ruleset, shared guards, one pure completion policy reused by engine and later signed progression, existing runner logic, display name helper, spoiler-free share mode labels; engine/shared tests and canonical engine/architecture/product/data/handoff/todo docs.
- **Out of scope:** enabling the public mode, server transport, browser persistence, lineups, editorial data, hosting, dependencies and aggregates.
- **Acceptance:** runners/forced walks/runs, three-out stop, ninth-batter stop, no post-completion mutation, points compatibility through nine, unchanged legacy formatting and behavior, mode-labelled sharing, full repository checks.
- **Stop conditions:** new baseball mechanics or generic policy framework; decompose above 12 handwritten files/600 net lines.

PR #141 merged this portable rules contract.

## PR B: web transport and progression

Scope contract: `tasks/plans/classic-web-transport.md`.

- **Goal:** allow the existing Daily server runtime to issue and advance signed `classic-inning-v1` progression without activating the public Classic browser experience yet.
- **Owning layer:** `apps/web` server transport/runtime, delegating completion to engine `isDailyGameComplete`.
- **In scope:** typed new-session bootstrap selection limited to `points-v3` or `classic-inning-v1`; explicit bootstrap ruleset identity; signed ruleset preservation through hint checkpoints and resolution; Classic completion at three outs or batter nine; no successor hint bundle after completion; existing signed points/legacy compatibility; focused transport/token tests and canonical docs.
- **Out of scope:** `/classic`, navigation, browser persistence namespaces, reset/refresh/result/share UI behavior, layout, persistence, hosting, aggregates, or lineup changes.
- **Acceptance:** default bootstrap remains points-v3; explicit Classic bootstrap signs Classic claims; points policies continue through three outs; Classic and legacy stop at three outs; all rulesets stop after batter nine; completed progression returns no hint bundle; token tampering remains rejected; full repository checks.
- **Stop conditions:** any browser persistence/public route activation or new API/dependency/authority boundary is deferred to PR C.

## PR C: mode-aware browser experience (stacked after PR B; pending)

- **Goal:** choose, play, resume and finish either mode without overwriting the other.
- **Owning layer:** `apps/web` transport/presentation/browser persistence.
- **In scope:** `/classic` and shared page composition; mode navigation/help, mode-labelled completion; independent Classic storage key and legacy default-key compatibility; terminal/complete refresh and reset; client initialization from the server-selected bootstrap ruleset; focused runtime/storage tests and browser QA; API/data/architecture/blueprint/handoff/todo documentation.
- **Out of scope:** puzzle identity/publication changes, new result database, auth, stronger anonymous anti-cheat, extra batters, hosting changes.
- **Acceptance:** each bootstrap authorizes only its current batter; Classic stops at third K/Give Up without a successor bundle; both modes stop at nine; mode tampering fails signature validation; refresh preserves each mode and recap; reset touches only the selected mode; points-v1/legacy saves survive; copy matches spoiler-free text; phone/tablet/desktop layouts; full CI/build/hidden-answer QA.
- **Stop conditions:** broader storage migration, new APIs/dependencies or cross-mode competitive fairness; decompose above 12 source/test files/600 net lines.

## Ownership and persistence decision

Rules live in engine/shared; the existing server adapter asks the same pure completion function when signing successor claims. The page chooses only an allowed new-session ruleset, which is signed before play. Browser state is initialized from that choice. Classic gets a namespaced date key; existing non-Classic keys stay readable, preserving points-v1/legacy rules rather than migrating totals. Names remain only in the private recap map. No durable server sessions, per-action writes, generic plugin framework or second editorial puzzle is needed.

## Release QA and sequencing

Verify correct/wrong/third-strike/Give Up, runner advancement and walks, three-out/nine-batter completion, active/pending/completed refresh, mode switching without save collisions, tampered ruleset tokens, spoiler-safe recap/shares, and desktop/phone/tablet layouts. Require full CI, hidden-answer checks, production build and exact-SHA Vercel verification. Physical iPhone/iPad touch and end-to-end latency QA remain separate gates. Aggregates, percentiles and new lineup systems wait until both modes are stable in production.
