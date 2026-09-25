# Terminal Jr./Sr. initials

Status: implementation and verification complete; merge and deployment are pending a Pacific-day boundary

## Scope contract

- **Goal:** omit a terminal `Jr` or `Sr` token from generated public initials while preserving every player's stored/display name.
- **Owning layer:** `packages/engine` owns `generateInitials`; the web adapter continues to call that shared implementation for current editorial puzzles.
- **In scope:** remove one trailing `Jr`/`Sr` token after punctuation/case normalization; expand the generator test matrix; remove the stale web-adapter comment; update canonical initials guidance, the archive/gameplay roadmap, handoff notes, and this plan.
- **Out of scope:** changing names, aliases, search, player data, `II`/`III`, archive identities, scoring, persistence, routes, or any generated data.
- **Acceptance checks:** `Ken Griffey Jr.` → `KG`; `Tony Gwynn Sr.` → `TG`; casing, final periods, and trailing whitespace work; interior tokens, hyphenated names, ordinary middle names, and `II`/`III` retain their current initials. Current editorial materialization uses the new generator through the existing shared adapter; schema-v2 permanent archives continue using frozen snapshot initials.
- **Rollout gate:** do not merge or deploy until the Pacific Daily date has rolled to the next day. This gives the beta puzzle and its result/comparison population a new date identity before generated clues change. Verify the Pacific date before merge and the production deployment's completion afterward.
- **Stop conditions:** if the next puzzle does not receive a distinct date/puzzle identity, if a same-identity beta save or result can be reinterpreted, or if archival v1 records would be exposed without a safe identity boundary, defer rollout and propose a separately scoped identity/version decision.

## Architecture

`generateInitials` is portable engine hint logic. It normalizes punctuation and spacing, tokenizes names, and emits one initial per retained token. The only new rule is to remove one final token equal to `jr` or `sr`, case-insensitively, after punctuation cleanup. `createPlayerIdentity` remains the existing web adapter for editorial and permanent materialization; its v2 archive path already overrides generated initials with the frozen snapshot.

No name normalization, player identity, persisted source data, or database contract changes. The rollout is operationally delayed until the Pacific date changes so the current beta puzzle and its comparison identity are not split across two clue versions.

## Verification

- Focused engine initials tests cover suffix spelling/case/punctuation and preservation cases.
- Run engine/web tests and typechecks, repository tests/typecheck/lint/file-size/documentation-impact checks, then exact-head CI and Preview.
- Fresh-eye review verifies that only terminal `Jr`/`Sr` are removed and the current archive v2 clue snapshot remains authoritative.
- Confirm the Pacific date before merge; after merge, verify exact-SHA main CI, production deployment, runtime errors, and the unchanged empty issued-puzzle table/security posture.

## Documentation impact

Update `docs/spec/player-data-quality.md`, `docs/spec/daily-inning.md`, `docs/START-HERE.md`, `tasks/todo.md`, and `tasks/plans/2026-09-24-archive-and-gameplay-roadmap.md`; add this plan.
