# Shared nine-at-bat progress tracker

Status: implementation scope, 2026-10-11.

**Goal:** Show completed, current, and upcoming at-bats as a nine-step visual tracker at the top of the existing Daily Nine gameplay, matching the user-supplied reference without copying its visual system literally. Keep the component reusable for a future Custom Nine player screen.

**Owner:** `apps/web` presentation only.

**In scope:** Read-only `AtBatProgressTracker` component with nine ordered stages, checkmarks for completed positions, filled numbered current position, outlined upcoming positions, textual `AT-BAT N OF 9` status, clear visible focus/accessibility semantics, responsive grid, tests, Daily Nine/Archive points-v4 gameplay integration.

**Out of scope:** Sitewide contrast changes (next PR), Custom Nine player page (separate UI effort), gameplay transition/scoring/persistence changes, Classic behavior, other modes, result-page redesign, data/DB/flags.

**Acceptance:** Static render tests for first, middle, terminal pending, completed; ordered aria labels; no player identities or hint content; 320px mobile fit, desktop fit, reduced motion compatibility; typecheck, Vitest, file-size, exact-head CI, READY Preview, bounded independent review and postmerge checks.

**Stop conditions:** If introducing this tracker would require broad Daily/Custom UI refactors or changes to score/state models, defer integration in favor of keeping the isolated reusable component.

**Architecture:** Props are presentation-only (stage count, completed numbers, active number). It consumes existing game state without interpreting baseball outcomes. No engine/data/server dependencies. Reuse in Custom Nine is a follow-up, not implied activation.
