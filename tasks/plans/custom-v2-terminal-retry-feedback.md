# Custom Lineup v2 — terminal restore failure feedback

Status: Bounded usability fix; no public activation.

## Scope contract
- **Goal:** A player who cannot reload the server-owned attempt after viewing an authorized terminal batter reveal sees an actionable error, without losing the reveal or changing eligibility.
- **Owning layer:** Web Custom Lineup v2 React presentation only.
- **In scope:** Extract the existing committed terminal panel as a small presentational component, display the existing sanitized restore error as a live alert, preserve Next batter / View final score retry controls, and cover error/normal/finished output in focused markup tests.
- **Out of scope:** Server attempt state, cookies, scoring, credentials, persistence, feature flags, creator UI, Daily Nine, Classic, Custom Nine v1, rate limits, and full hosted application-to-database acceptance.
- **Acceptance:** Focused Vitest and web typecheck; manual Chromium 375px, N=2 simulated bootstrap/terminal/503 demonstrates hidden error on main and visible retry alert after fix; existing 1/5/9/10 phone-width layout checks at 320/375/390/430 without horizontal scroll; exact-head CI success, READY Preview, independent bounded review.
- **Stop conditions:** A fix requires new server behavior, new game rules, changes to protected answers, broader client state rewrites, or public flag activation.

## Architecture
Reuse the existing sanitized error state, existing restore() action and PlayerRevealCard. The new terminal panel is a presentation-only child in apps/web, with no new dependencies or game logic. This fixes an actual silent failure observed with real Chromium and a mocked HTTP 503 while preserving the authorized revealed player and retry path.

## Evidence limits
Mobile QA used a locally enabled Custom v2 page with intercepted API responses (not a hosted Supabase-backed session). The 1/5/9/10 scorecard at 320/375/390/430 had no horizontal overflow, and the v2 creator accepted 10 distinct mocked search results at 320px. Real hosted HTTP-to-database gameplay, staging service credential setup and activation remain outstanding.
