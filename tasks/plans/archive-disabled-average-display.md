# Disabled archive average presentation

Status: Implemented; validation/review/deployment gates pending

## Scope contract

- Goal: archive scoreboard AVGs show unavailable dashes rather than permanent loading indicators, during play and after completion.
- Owning layer: apps/web presentation; the existing archive detection supplies comparison availability.
- In scope: scoreboard presenter, its two game call sites, focused regression coverage, and canonical verification checkpoint.
- Out of scope: hosted archive populations, network hooks, result delivery, scoring, persistence, physical/mobile QA, admin authentication, and permanent launch.
- Acceptance: disabled comparisons override missing/loading/cached values; enabled Daily behavior remains intact; focused/full web tests, typecheck/lint/file sizes, CI, READY Preview, bounded review, live browser check and production verification.
- Stop conditions: any API, schema, authority, scoring or persistence change requires separate scope.

## Architecture decision

The presenter already distinguishes unsupported rulesets from pending reads. Add explicit comparison availability to that presentation boundary, supplied by existing archive classification. Preserve the default for existing current-Daily consumers. Disabled comparison values must not appear pending or expose stale cache data. No package/domain dependency changes.

The implementation passes existing archive availability at both active and completed scoreboard call sites. Eleven focused checks and all 681 web tests passed. Workspace typecheck, lint, file-size and whitespace checks passed. Strict data pipeline and production build passed, including hidden-answer QA of two payloads and 31 client chunks (879730 bytes). Exact-head CI/Preview, bounded review and production gates remain required. Build-generated unrelated saves/Next configuration changes were excluded from the commit.

## Verified browser checkpoint

Cloud Chrome successfully opened the public archive on October 5, 2026. Hint, correct Guess, Give Up, Next, all-nine completion, active/completed refresh, exact spoiler-safe clipboard URL, second-tab follower lock and archive reset preserving current-Daily hint progress passed. No current-Daily result was submitted. Other archive puzzle reset isolation remains unverified because only one puzzle is issued. Physical mobile and authenticated admin QA remain open. The scoreboard showed loading AVGs during play and completed TOTAL AVG despite disabled archive comparison reads, motivating this bounded fix.

#297 merged as fdd3d86835e7916f431c8a398460c8cb902890d6; final-head CI #1025 and READY Preview passed. Push CI #1026 passed; production dpl_4w2Mxyv79uSg75Xak7RpdhBLUC94 READY/canonical, expected routes 200/404, post-READY error/fatal scan clean, one unchanged beta row and zero permanent rows. Issue #294 checkpoint reconciled and remains open for authenticated admin/mobile QA.
