# At-bat progress: score left / stage right

Status: scoped implementation, October 11, 2026.

## Scope contract

**Goal:** Under the existing nine-circle progress tracker, show a single horizontal status row with the cumulative points score left-aligned and AT-BAT N OF 9 right-aligned.

**Owning layer:** `apps/web` pure presentational component and points-v4 Daily Nine UI composition.

**In scope:** Typed numeric `score` input to the existing reusable tracker; accessible single-line score/status row; responsive alignment (320px and desktop); derive score from existing `displayedPoints.points` (including an awarded but not yet advanced terminal at-bat), preserve all nine completion states; adjust focused render tests and canonical product documentation.

**Out of scope:** Score calculation, storage, submission, answer/hint logic, gameplay API, Classic or Custom Nine player screens, sitewide contrast (PR #388), a second scoreboard, any structural UI redesign, data migrations.

**Acceptance:** Score left/status right; zero/negative/large/half-point score display; expected row for partial/completed game; no scoring duplication; responsive and keyboard/reader behavior; focused tests/typecheck/file-size and exact PR-head CI/READY Preview/independent review.

**Stop:** If accommodating this row requires changing the rule engine or reworking parent gameplay layout, split instead of broadening the PR.

## Architecture

The tracker remains read-only: the parent supplies existing cumulative points and terminal-aware displayed completed at-bats. The tracker formats that number but owns no calculation. Reusable by Custom Nine presentation once available.
