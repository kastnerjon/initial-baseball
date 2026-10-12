# Custom Nine — authoritative attempt resume progress

Status: Bounded implementation scope (2026-10-11).

## Scope contract

**Goal:** Let a player-facing Custom Nine browser recover the saved attempt's current strike count and previously completed at-bat facts on reload.

**Owning layer:** `apps/web` server attempt bootstrap and HTTP transport.

**In scope:** Add `attemptProgress: {strikeCount, completedAtBats}` for valid reserved attempts; verify Custom-specific signed token scope, current pitch/reveal/out counters, ordered terminal facts and frozen initials; preserve creator preview response and sanitized no-store errors; focused tests and API documentation.

**Out of scope:** Browser game UI, hint customization, game actions, score calculations, Supabase schema, Daily/Archive/Classic, public creation, competitive flag changes and the proposed all-zero scoring rule.

**Acceptance checks:** Initial and resumed sessions; signed current wrong guesses; prior resolved at-bats; signed token tampering, wrong challenge, mismatched pitch/out/initials and completed attempt fail closed; no upcoming hints, full player names, private answer IDs or attempt UUIDs; tests and typecheck, exact-head CI, READY Preview and bounded independent review.

**Stop conditions:** New persistence/authority model, changes to scoring, completed-game resume policy or browser state coordination require separate decisions and PRs.

## Boundary and compatibility

The Custom-specific browser ledger already stores ordered terminal facts plus a signed current progression token. The route now projects only those facts and current wrong guesses after consistency validation. It does not add persistence reads/writes, change token format, or grant authority to browser-local saves. Existing stateless Custom routes remain noncompetitive; creators continue to receive only `creator_preview`, not an attempt-resume payload. Daily Nine/Archive remain unchanged.

## Release evidence

Fill in after exact-head CI, review, preview verification, merge and postmerge checks. A local focused test pass alone does not establish deployment.
