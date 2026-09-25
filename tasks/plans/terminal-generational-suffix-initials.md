# Terminal Jr./Sr. initials

Status: historical beta compatibility correction in progress; rollout date is September 28, 2026

## Scope contract

- **Goal:** omit a terminal `Jr` or `Sr` token from new public initials while retaining the original initials for every older beta puzzle.
- **Owning layer:** `packages/engine` owns both portable suffix policies; `apps/web` selects the beta policy by puzzle date at the existing pitch adapter.
- **In scope:** remove one trailing `Jr`/`Sr` token after punctuation/case normalization on and after September 28, 2026; keep the previous policy before that date for editorial, deterministic fallback, editor previews, and schema-v1 archive materialization; expand focused tests and update canonical guidance and handoff.
- **Out of scope:** changing names, aliases, search, player data, `II`/`III`, archive identities, scoring, persistence, routes, or any generated data.
- **Acceptance checks:** `Ken Griffey Jr.` yields `KGJ` through September 27 and `KG` starting September 28 in both editorial and fallback puzzles; `Tony Gwynn Sr.` follows the same policy. Interior tokens, hyphens, `II`/`III`, names, and aliases remain unchanged. Schema-v2 permanent archives continue using frozen snapshot initials.
- **Rollout gate:** production must be running the date-aware code before the Pacific day begins September 28. If that cannot be verified, move the cutover to a later future Pacific date before deployment. No historical date may switch policies after having been served.
- **Stop conditions:** if any public or result-write path generates historical initials without the date policy, or if the chosen cutover cannot precede the first serving of its puzzle, defer rollout.

## Architecture

`generateInitials` is portable engine hint logic. Its explicit terminal-suffix policy can include the historical `Jr`/`Sr` initial or omit it. `createPlayerIdentity` remains the existing web adapter: beta puzzle creation and editor preview supply their selected date, and the adapter selects the historical policy before September 28. Schema-v1 archive materialization supplies its issued puzzle date; v2 materialization continues to use frozen snapshot initials.

No name normalization, player identity, persisted source data, or database contract changes. PR review found that a day-boundary-only rollout would rebuild older puzzle initials under the new rule and reject delayed result submissions. The owner approved retaining older initials on September 25. The explicit date policy repairs that result compatibility without renumbering or rewriting old puzzles.

## Verification

- Focused engine initials tests cover both policies; web tests cover editorial and fallback puzzles on either side of the cutover.
- Run engine/web tests and typechecks, repository tests/typecheck/lint/file-size/documentation-impact checks, then exact-head CI and Preview.
- Fresh-eye review verifies historical result replay, suffix behavior, and archive v2 snapshot authority.
- Verify production deployment before the September 28 Pacific day; after merge, verify exact-SHA main CI, production deployment, runtime errors, and the unchanged empty issued-puzzle table/security posture.

## Documentation impact

Update `docs/spec/player-data-quality.md`, `docs/spec/daily-inning.md`, `docs/START-HERE.md`, `tasks/todo.md`, and `tasks/plans/2026-09-24-archive-and-gameplay-roadmap.md`; add this plan.
