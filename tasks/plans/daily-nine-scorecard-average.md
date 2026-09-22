# Daily Nine scorecard/share average

Status: issue #216 correction after PR #229
Date: 2026-09-22

## Scope contract

- **Goal:** show each resolved Daily Nine at-bat's existing comparison AVG on the ongoing private scorecard, completed private scorecard, and spoiler-safe share output.
- **Owning layer:** `apps/web` presentation and browser comparison-read lifecycle.
- **In scope:** read the existing same-puzzle/same-ruleset/same-pitch aggregate for completed scorecard rows; format displayable averages as ordinary one-decimal points such as `AVG 4.8`; withhold 0–1 observation averages; refill missing rows after restore; quietly retry low-sample/unavailable rows when another AB is completed; decorate the existing spoiler-safe share pitch lines with the same per-AB AVG; remove PR #229's mistaken whole-game AVG decoration from the scorecard/share surfaces while preserving the separate completed-game YOU / AVG / BEAT panel; focused tests and canonical docs.
- **Out of scope:** onset-of-AB AVG display, new aggregate calculations, Supabase/API/shared/engine changes, scoring changes, result-write behavior, persistence-schema changes, historical comparison snapshots, Classic comparison, or unrelated browser/mobile verification.
- **Acceptance checks:** ongoing and completed private scorecard rows show `AVG x.x` only at 2+ observations; share output adds the same per-AB value without answer names; 0–1/loading/unavailable states fail quietly; restore can repopulate completed rows from current aggregates; different pitch reads may complete independently; stale/replaced/session-invalidated callbacks cannot populate rows; comparison reads never block Guess/Give Up/Next/result delivery/sharing; focused tests, typecheck, file-size/full CI and exact-head Preview pass.
- **Stop conditions:** any need to change comparison population semantics, scoring, storage, result authority, provider SQL, or portable share/game contracts becomes separate work.

## Corrected product semantics

PR #229 interpreted issue #216 as an additional whole-game AVG inside the scorecard/share surfaces. That was not the intended requirement.

The scorecard comparison is per AB. For example, after BB resolves, its row may read:

`BB  Barry Bonds  AVG 4.8  K`

The separate completed-game comparison card remains whole-game YOU / AVG / BEAT. It is not the scorecard AVG.

For now, AB averages use ordinary points formatting to one decimal place. Baseball-style notation such as `.480` is not used.

## Read lifecycle

The active-AB prefetch remains unchanged and continues to support terminal YOU / AVG presentation without putting comparison on gameplay's critical path.

Scorecard rows have a distinct read lifecycle because they survive after the active hook moves to the next pitch. The web consumer therefore keeps an ephemeral per-pitch scorecard comparison cache:

1. when a pitch enters the completed scorecard, read the existing at-bat comparison endpoint for that exact pitch;
2. store only presentation read state in memory, never in gameplay persistence;
3. on a restored game, fetch the currently completed pitch rows again from the current aggregate;
4. if a row was unavailable or still had only 0–1 observations, allow a quiet refresh when the scorecard gains another completed AB;
5. stable 2+ rows are not repeatedly re-read during the same session.

A small per-pitch request controller permits independent row reads while fencing replaced or invalidated callbacks. Restore/refill work is capped at three concurrent scorecard reads, with never-read rows prioritized ahead of low-sample retries. These reads are asynchronous and fail quiet.

## Share safety

The engine-owned `DailyShareResult` and `formatDailyShareText` remain unchanged and portable. Web presentation decorates only existing spoiler-safe pitch lines, for example:

`BB: K · AVG 4.8`

No player answer names, raw observations, participant identifiers, BEAT percentages, or per-user details enter the share text.

Because comparison rows can arrive after the share surface is already usable, the existing exact-text clipboard state remains important: if displayed share text changes after an earlier copy, the UI no longer claims the updated text was already copied.

## Documentation impact

Reconcile START-HERE, todo, architecture and the comparison roadmap so issue #216 records per-AB scorecard/share AVG as the intended requirement and PR #229's whole-game scorecard interpretation is superseded.
