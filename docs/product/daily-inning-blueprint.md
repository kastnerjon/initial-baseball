# Daily Inning end-to-end blueprint

Status: Living product source of truth  
Last updated: 2026-09-23

## Product decision

Initial Baseball currently exposes **Daily Nine** as the normal/default browser game. **Classic Inning** remains a distinct implemented beta game over the same daily baseball puzzle, but it is hidden by default through a server-only web availability setting. This is a reversible presentation/route decision, not deletion: Classic rules, saves, results, comparison infrastructure, and data remain intact. Shared lineup content is a current product choice, not a permanent identity constraint.

Current Daily numbering is beta and is not the permanent historical sequence. At a later explicit launch decision, permanent numbering restarts at **Daily #1** and prior beta history is not imported into the public archive. Detailed settled direction: `docs/product/beta-launch-results-archive.md`.

October 8 owner decision commits **Daily Nine â€” Custom Lineup** as the next planned mode after the now-live opt-in leaderboard. It will be a creator-selected immutable, shareable nine-player challenge using the same current Daily Nine gameplay; creators do not contribute competitive scores. **Specific Lineup** (team/era configuration with one shared puzzle per daily configuration) is paused, and head-to-head remains future Classic-engine work. The scoped Custom MVP contract is `tasks/plans/custom-nine-mvp.md`; no custom route or UI is live yet. Native and other themed mode¶»§q«^