# Private Custom Lineup v2 first-attempt reservation

Status: staged private Web boundary, October 14, 2026.

## Scope contract
- Goal: reserve one immutable first scored attempt per signed, challenge-specific browser credential for issued v2 1–10 players.
- Owner: Web private attempt services and Supabase adapter. No change to portable rules.
- In scope: v2-scoped HttpOnly cookie and creator-marker separation; exact-N private attempt row validation; insert-once/concurrency reread; signed initial progression checks; redacted response; missing-row and advanced-state fail-closed; focused tests.
- Out of scope: public HTTP/API, creator issuance endpoint, hint/guess/terminal CAS, completed receipt restoration, results/admission, comparison UI, Daily/Archive/Classic/v1 changes or SQL migrations.
- Acceptance: 1/5/9/10, first reservation, no retry after cookie loss in a valid cookie, concurrent same-key first-winner consistency, creator never admitted, tamper/cross-version rejections, no hidden answers or future hints; review, exact-head CI, READY Preview.
- Stop: Any public game activation, ownership proof/account identity or new SQL/competition authority requires a separate PR.

## Architecture
v2 reuses the private v1 table and shape checks with an explicit immutable N. Unlike v1, v2 reservation adapter exports no update/CAS method. V2 credentials and creator markers are challenge-scoped, independently signed and host-only. The private bootstrap projects only authorized hints. Advanced attempts intentionally return continuation_pending until a separately reviewed signed continuation service exists. This does not prevent creators deleting cookies or switching browsers; future public competition must review that abuse risk.

## Documentation impact
Updated canonical handoff and current work checklist. No public changes, new dependency or hosted SQL.
