# Daily Nine — optional leaderboard

Status: Owner-approved feature; implementation staged after PR #343.
Last updated: 2026-10-08

## Settled product behavior

- First release: **Daily Nine — Universal Lineup** only. The system must preserve a puzzle/ruleset identity seam for future Custom Lineup; do not implement Custom Lineup in this work.
- A player who completes a game may optionally submit a public display name (or nickname) and their **first eligible completed attempt** to that puzzle's leaderboard. Playing without submitting remains unaffected.
- Display the **Top 10 named entries** for the exact puzzle/date/number/points-v4 ruleset, plus the submitting player's own rank, even when it falls outside the displayed Top 10. The leaderboard retains every submitted entry.
- Equal scores share a **standard competition rank** (1, 1, 3). Submission time orders tied rows for a deterministic Top 10 display **but does not break ranking ties**; at most ten public rows are displayed, even when a tie crosses the cutoff.
- The server derives points from the **existing immutable completed-result row**. The browser never supplies a leaderboard score. The public leaderboard returns display names, ranks and scores only; no anonymous submission IDs, completed-at-bat facts, or hidden player answers.
- Display names are public, opt-in, whitespace-trimmed, 1–32 characters, control-character-free. Initial submission is immutable, not a profile or verified identity.
- Resets and subsequent browser replays cannot obtain another eligible first-attempt result on that browser; leaderboard submission must reuse the original durable completed-result ID. Other devices cannot be proven to represent the same person before account authentication.
- The existing completed-result API validates gameplay fact consistency and derives scoring, but anonymous clients could still fabricate plausible at-bat facts; therefore this leaderboard is **casual and not cheat-proof**. No misleading verified-person or fraud-proof claim.
- Preserve current Daily Nine gameplay, per-AB and final AVG/BEAT comparisons (which include non-leaderboard contributors), Classic, archive and unpublished answers.
- Later Google/Microsoft authentication and possible Yahoo support must not be installed or assumed now. Anonymous entries must not be automatically claimed or linked to accounts without proof.

## Implementation boundaries

The storage migration adds a locked-down RLS-enabled table keyed by an existing completed-result submission ID. A service-role-only read function computes ranking directly from existing engine-derived JSON summary points; names alone are new state. The next bounded web API PR validates the public request, checks that the existing completion belongs to the requested puzzle and current points-v4 policy, and enforces immutable first-write-wins naming. A separate end-of-game UI PR reads and submits after actual completion. No direct client database access.

The leaderboard read is intentionally **opt-in only** and should not be mistaken for the existing anonymous total score comparison population.
