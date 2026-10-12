# Daily Nine — hint action and resolved reveal hierarchy

Scope contract · 2026-10-12

## Goal
Reduce visual clutter and improve the order of information in the existing Daily Nine game card.

## Owner and boundaries
Primary owner: `apps/web` presentation only. No new game/scoring rules, runtime APIs, Supabase schema, data corrections, persistence, or package dependencies.

## In scope
- Move the existing **Reveal Next Hint** button out of the hints section and beside **Submit Guess** in the game card actions, retaining **Give up** separately on the left on larger screens.
- At mobile sizes, keep Reveal and Submit adjacent in their own full-width row to prevent cramped/overflowing three-button layouts; preserve focus order, disabled/loading states, v3 points cost and terminal behavior.
- Remove the decorative horizontal dividers from active hints and the resolved reveal/comparison sections. Preserve meaningful statistic-table borders and the outer game-card border.
- Put the complete canonical Player Reveal before the score comparison tiles/histogram on a resolved at-bat. Keep Next At Bat after comparison; preserve historical v3 outcomes.
- Update focused rendering/CSS regression tests and the canonical gameplay blueprint.

## Out of scope
No editorial restyle, hint rules, hint contents, score calculations, player lookup, card redesign, leaderboard, Custom Nine player screen, admin workflow, data migration, or distribution chart change.

## Acceptance and stop conditions
Focused tests cover action ordering, hint caps/loading/v3 cost, terminal reveal above comparative scores and chart, separator removal, and narrow-screen action structure. Then typecheck, lint/build/file-size and exact-head GitHub CI, READY Vercel Preview, bounded independent review and post-merge verification. Stop for any architecture/scope change or conflicting parallel UI PR.

## Architecture
The same button callback `onRevealHint` and existing `onSubmit` remain directly wired in `AtBatCard`. No second game logic or alternative scoring is introduced. Player reveal is unchanged, only moved before the peer-comparison component in DOM order for accessible reading order. CSS uses local component selectors, not global elements.

## Verification
Pending exact-head CI, Preview, review and production checks.
