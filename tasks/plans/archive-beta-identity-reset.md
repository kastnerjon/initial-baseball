# Archive-beta identity and reset boundary

Status: implemented on branch; verification pending

## Scope contract

- **Goal:** define a portable pre-launch archive-beta series identity that can number real immutable test puzzles without creating or implying the eventual permanent Daily #1.
- **Owning layer:** `packages/daily`.
- **In scope:** one explicit `archive-beta-v1` series identifier; an explicit test-series epoch supplied by callers; date <-> beta Daily-number mapping; a distinct beta puzzle-identity namespace for future issuance; focused tests; and canonical documentation that defines retirement/reset as a series/data-boundary operation.
- **Out of scope:** Supabase schema changes or writes, issuing any puzzle, configuring a beta epoch in production, archive routes/navigation/gameplay, results/comparisons, browser history, deleting/resetting hosted data, choosing the permanent launch date, or changing `permanent-v1`.
- **Acceptance checks:** beta start date maps to #1; earlier dates are non-members; inverse mapping is calendar-stable across leap/DST boundaries; invalid dates/numbers/series fail closed; `archive-beta-v1` is structurally distinct from `permanent-v1`; existing permanent identity behavior remains unchanged.
- **Stop conditions:** if safe beta identity requires changing persistence, issuance, result authority, public routing, or the permanent-series contract, stop and split that into the next bounded PR.

## Architecture decision

Pre-launch archive testing uses a distinct portable series namespace: `archive-beta-v1`.

That series is disposable as a whole. Issued puzzles inside it will still be immutable once the later issuance PR writes them. Broad launch does not rename, reinterpret, or migrate those identities into `permanent-v1`; it retires the beta series/test data and separately starts `permanent-v1` from an explicitly chosen permanent launch epoch at Daily #1.

The beta epoch remains explicit input rather than a configured constant in this PR. Therefore merely defining the beta identity cannot silently activate archive testing or establish a launch date.

## Dependency and boundary notes

The calendar arithmetic is the same product-neutral mapping already used by permanent identity. Extract only the small internal calendar helper needed by both portable identities rather than duplicate date/number logic. No web, database, React, Supabase, scoring, or generated-baseball-data dependency is introduced.

The existing immutable issuance/read contracts remain `permanent-v1`-only in this PR. The next archive-beta issuance concern must explicitly widen the append-only persistence/codec/service path for `archive-beta-v1` before any hosted test row is written.


## Verified starting state

At the start of this PR, live `main` was `5df13f7fa8bbcb9aad578733550a089d305c200e` with no open PRs. A read-only hosted Supabase check confirmed `public.permanent_daily_issued_puzzles` contained zero rows and still constrained `series_version` / `puzzle_id` to `permanent-v1`. This PR deliberately leaves that hosted persistence unchanged.
