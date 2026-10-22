# Initial Baseball — architecture, engagement flow and build order

Date: October 22, 2026. Status: **review and recommended direction**, not shipped behavior or permission to activate features. Requested by the owner after Astra's interruption-QA pass. Canonical product rules remain authoritative until a scoped implementation PR adopts the relevant recommendation.


## Owner clarification — Discover and friends (October 22; supersedes earlier visual direction)

**Accepted direction:** retain the play → reveal → result/share → return/invite loop. The owner does **not** approve the HTML's specific screens or visual design. Do not implement or treat that artifact as a design specification. The supplied exploratory brand tokens introduce navy `#041E42`, crimson `#BF0D3E`, white, Barlow Condensed display and Inter UI typography; use these as input to the next visual exploration, subject to accessibility checks, rather than assuming the earlier green/cream recommendation is approved. Files remain unchanged.

**Explicit product requests:** Discover public Custom Lineups sorted by newest or popularity; per-challenge scoreboards; easy comparison with friends, preferably a selector at the top of today's result. Friends who have completed should appear first; other friends can appear separately. The friendship mechanism below is a recommendation, not a settled authorization/privacy contract.

### Concrete interaction recommendation
- Discover is a first-class destination once publishing is released, alongside Daily, Create and My Results. Keep Daily as the default arrival. Only intentionally published challenges appear; unlisted friend links stay unindexed.
- Two clear sorting choices: **Popular** and **Newest**. Recommend Popular defaulting to this week, with an all-time option. Newest sorts by publication time. Popularity uses eligible accepted first noncreator completions in the stated window, never raw views, creator previews or repeated submission calls. Anonymous attempts are not unique humans. Freeze the precise ranking/tie policy in its owning PR.
- Cards show title, length and permitted creator display identity plus completion count; no roster/answers. Each challenge has its own scorecard/scoreboard. Public names/results require explicit visibility rules; anonymous participants need not publish a name. Do not compare raw totals between different lengths or challenges.
- At the top of the completed Daily result: **Compare with [Everyone / friend]**. Everyone shows the existing eligible aggregate; it is not a ranked list of all anonymous users.
- Friend selector groups **Finished this lineup** first, then **No shared result yet**. Before a privacy/availability contract exists, absence of a visible result must not be labeled as proof that someone has not played. Names with no shared completion offer a normal challenge/share action, not a fake comparison.
- Selecting an eligible friend shows You / Friend / Difference for the total and each batter, using the same immutable puzzle, mode, ruleset and original eligible results. Answer-bearing detail appears only when both have completed. Never show another player's unfinished guesses or clues. Preserve unavailable/restricted results and tied-score states honestly.
- Same pattern applies to an exact Custom challenge. A Friends scoreboard is the group view; the selector is the one-to-one drill-down. Head-to-Head remains a separate future gameplay mode, not a prerequisite for comparing already-completed games.

### Minimum viable friends recommendation
Optional accounts plus an invite link and accepted friendship are enough; no contact upload, chat, activity feed or follower system needed. Friends are not inferred from nicknames, a shared IP, or possession of a challenge URL. Let users remove a connection and control shared results; revoked visibility must be enforced by the server. Sharing and anonymous play remain available without accounts. A temporary explicit result-comparison invitation could be a separate pre-account slice, but it is not assumed to exist and must not expose attempt/owner credentials.

### Revised priority
Finish Custom launch evidence → improve the core daily/result experience → permanent Daily/history prerequisites → **optional accounts, result association and a minimal friends-comparison slice** → Discover publishing/sorting/scoreboards → Head-to-Head → native. Friends comparison is now an explicit engagement priority, not an incidental benefit of accounts. Discover remains committed future direction; its publishing/moderation/privacy requirements still apply. Validate small comparison/history slices before building a broad social system.

The recommendation is to place friend comparison ahead of a sophisticated public discovery feed because it directly serves the owner's stated daily use case. A simple Discover directory can follow its safety/ownership prerequisites without waiting for advanced rankings. This is planning; no feature flags, production code or release gates changed.

## Scope and evidence

Goal: make the next engineering decisions support one coherent daily baseball habit. Owning concern: product/architecture planning. In scope: current architecture assessment, screen flow, implementation order, measurement and a disposable visual concept. Out of scope: product code, migrations, flags, accounts implementation, operational changes and another review of #488/#489.

Verified main: `411d5ac4786d8039254664c189348fdba014c8c4`. #489 remains open at `e1a9ab1c283a2aa984f6ba23c51e874756f20647` at this review's initial read; no new CI/deployment certification is claimed. The previous checkpoint remains the release-evidence record.

Read AGENTS, the architecture plan, relevant product blueprint sections, current todo, package manifests, Daily/Custom presentation, creator/history adapters, immutable issuer and signed completion/reservation boundaries. A focused scan found no React/Next/Supabase/browser-storage imports in engine/shared/Daily source; this is a bounded architectural check, not an exhaustive security audit.

Viewed the public Daily #179 first-open help and active desktop screen. Did not submit production guesses or results. Custom observations are from source/CSS because its public flags are OFF. Did not perform new physical-device or hosted Custom acceptance. Companion `initial-baseball-flow-concept.html` uses illustrative data only; it is not a live game or backend prototype.

## Verdict

**Keep the architecture. Concentrate investment on release proof and a coherent player journey.** The package split and server boundaries are appropriate for the planned product. There is no demonstrated reason for a rewrite, microservices, Redis, an event bus, a generic game framework or native clients now. This review does not certify capacity at a particular traffic level.

| Boundary | Assessment | What to preserve / change when needed |
|---|---|---|
| shared → engine / baseball-data → daily → web | Good existing separation; manifests match intended dependency direction | Pure rules and canonical facts stay portable. Visual work belongs in web. |
| Immutable challenge issuance | Good foundation: ordered identities, clue snapshot, ruleset and length; separate owner capability | Edits produce a new challenge when that feature is built. Never mutate a friend's issued game. |
| Signed Custom attempt and admission | Correct shape: credential-bound state, revision/token conditional updates, engine-derived completion | Hosted concurrency/recovery remains a release gate. Browser locks coordinate clients; database predicates enforce transitions. Neither establishes a unique human. |
| Daily vs Custom clients | Different lifecycles are real: Daily's browser save/outbox and Custom's server rehydration | Share visual primitives where useful, not a combined persistence controller. Do not copy Daily's locally revealed hint behavior into Custom's server-counted hints. |
| Results and accounts | Browser history currently covers Daily/Archive/Classic, not a unified synced Custom history | Later associate authorized immutable server results with a user; build a read projection over mode-specific records. Do not promote local scores into verified results or auto-import beta history. |
| Future Head-to-Head | Existing Classic outcomes/runner engine is reusable; multiplayer authority is missing by design | A separate match lifecycle must own turns, roles, queued hidden selections and retries. Do not cram matches into Daily editorial records or Custom attempt cookies. |

The practical architecture improvement is **shared presentation with explicit mode adapters**. Start with color/type/control tokens and a small score/progress/result vocabulary. Extract a component only when Daily and Custom actually use the same behavior. Keep mode-specific orchestration in its existing owning layer. No new package is needed for this.

One maintenance issue has real operational cost: `docs/START-HERE.md` contains multiple older, contradictory current-state sections. At the next reconciliation, replace its top operational snapshot with one current entry and link the historical handoff. Do not spend a separate engineering cycle reorganizing all documentation.

## What merits UX work

1. **Returning players repeatedly encounter instructions.** `DailyHowToDialog.tsx` calls `openDialog()` on mount. Keep full rules one tap away; show a short first-use explanation once per ruleset, with a storage-unavailable fallback that never blocks play. Do not make every visit dismiss a long table.
2. **The active task competes with other content.** The live Daily page shows progress, the game, expanded Your Nine, Top 10 and reset. Keep initials, clues, search and actions primary. Keep prior at-bats available in a compact disclosure; place leaderboards and full comparisons after completion. Preserve today's established scoreboard column layout rather than another speculative width change.
3. **Sharing is late in the completion hierarchy.** `GameCompleteView.tsx` renders scoreboard, leaderboard and distributions before `DailyShareCard`. Put the final score and share action first, with scorecard and deeper analysis underneath. Do not remove useful statistics.
4. **Custom feels like a different application.** Its CSS uses navy/blue cards and a different masthead while Daily uses forest/cream/serif. Unify the shell and interaction labels; preserve Custom's different server lifecycle. Its final state should give a meaningful score, spoiler-safe share and next action, while honestly distinguishing completed gameplay from result-admission retry.

These are usability hypotheses supported by observable structure. They are not measured causes of churn and do not justify claiming a retention uplift yet.

## Patterns to borrow from established daily games

- NYT Connections places statistics and sharing together after completion and offers play without required sign-in. Its archive distinguishes unstarted, in-progress and finished states, and archive play does not extend the daily streak. Borrow the clear state and result/share grouping; do not copy its branding or exact rules. [NYT Help Center](https://thenewyorktimeshelpcenter.helpjuice.com/360011158491-New-York-Times-Games/28525912587924-Connections)
- LinkedIn Queens uses a discrete daily puzzle and a results page with comparisons, streaks, sharing and other games. Borrow a satisfying finish and a clear reason to return. Reminders and social identity are later opt-in features, not prerequisites for baseball play. [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a6269510)
- Immaculate Grid makes rules available above the board and explains category/team meaning contextually. Borrow compact, contextual explanations and reliable baseball semantics rather than adding a large tutorial before every game. [Sports Reference rules](https://faq.sports-reference.com/portal/en/kb/articles/rules-for-immaculate-grid)

These sources establish design patterns, not causal evidence that copying them improves engagement. The NYT game URLs themselves were inaccessible to the search tool; the referenced help content was readable. No competitor account or app was played in this review.

## Recommended application flow

The core loop is **arrive → play → learn/reveal → finish → share → return**. Custom adds a natural friend invitation loop. Optimize meaningful completed games and voluntary return, not maximum screen time.

### Navigation and arrival

- Keep `/` as the Daily destination. Do not insert a games portal or mandatory Play button before the existing game. A returning active player resumes; a completed player sees today's result. New visitors receive a compact explanation with an example and optional full rules.
- Use a consistent compact header with Initial Baseball, daily edition or Custom title, and Help. Secondary navigation: Daily, Archive, My Results; add Create only behind existing release gates. A future profile entry appears only when accounts exist. Do not show disabled Discover/Head-to-Head/native teasers.
- A shared Custom URL opens that challenge directly, not home or registration. Show title, count and a short rules sentence without revealing the roster. Keep creator-preview and friend states distinct. Do not invent a verified creator name from anonymous ownership.
- Current production name remains Daily Nine. Future **Daily Lineup** naming ships with the approved configurable-length phase; UI derives N and maximum score from the issued ruleset. No separate Daily Five product.

### Active at-bat

1. Compact progress with an accessible current/total label and score; visual tracker can retain the current circles. It must adapt to issued length rather than assume nine in new Custom components.
2. Large initials and one active clue area. Display the points available for a correct answer using the engine's policy, not `4 - hints`: the fourth hint is worth 0.5 under points-v4.
3. Player search with identifiable candidates, keyboard selection and explicit Submit. Selecting a candidate must not consume a guess. Distinguish no matches, searching and search failure.
4. Reveal hint beside Submit; Give up is quieter and spatially separate. State the consequence clearly. Preserve rules: first two wrong guesses cost strikes, not points; third ends the at-bat.
5. Keep the input and actions reachable with the mobile keyboard open. Avoid a fixed footer covering suggestions. Respect text zoom, visible focus, reduced motion, existing high-contrast targets and approximately 44px touch controls.
6. Pending actions have clear status and prevent duplicate input. Network trouble offers retry/restore without silently resetting progress. Cross-tab conflicts restore server state; UI must not claim an unconfirmed action was accepted.

### Reveal and completion

- After each terminal at-bat: canonical player reveal, authoritative points, concise comparison if available, then Next batter. No automatic advance that removes the learning moment; no mandatory celebration delay. Keep richer stats available below.
- Final screen: edition/title → **score / maximum** → a compact spoiler-safe score strip → **Share result**. Then one useful contextual next step and expandable scorecard/comparison/leaderboard.
- Daily completion: show the actual next-puzzle availability in Pacific time, not a drifting browser-local daily epoch. Offer Create a lineup after activation and Archive as secondary. A same-day return restores the final result.
- Custom completion: Share result for this exact challenge, then Make a lineup for friends and a link to today's Daily. Do not rank a one-player Custom result alongside a ten-player one or mix rulesets/challenges in comparison populations.
- Keep saved/admitted, pending and failed admission distinct. Completion display can remain visible during an idempotent save retry; do not imply leaderboard eligibility until confirmed. Shared output contains no player names, future clues, owner code or credential.
- A future daily completion streak should count the official day's first eligible completion, not require a high score. Define timezone, late completion, reset/replay and archive exclusions before implementation. Do not display invented streaks or silently import beta history.

### Create → friend

- Select 1–10 canonical players; reorder using the existing accessible picker; enter a title. Keep the current tested default selection behavior until a specific usability test supports changing it.
- Review title/order/count and the fact that the issued challenge is fixed. Primary action: Create share link. Do not call this Publish: that will mean intentional public discovery later.
- Success: obvious friend link and Copy link (native share when supported, copy fallback retained). Put owner recovery information in a clearly separate private section. Never copy the owner capability with the friend link. No promise that it is recoverable or synced.
- Owner opening the link sees a creator view/exclusion notice, not an eligible scored friend attempt. Friend opening it gets the normal game; fresh, resumed, completed and unavailable states are explicit.
- If creation response is lost, do not promise safe duplicate-free retry or recovered ownership. Issue #471 remains its own bounded recovery decision; resolve based on evidence, not by adding accounts to this launch.

## Build order and gates

Order expresses dependencies and value, not a calendar commitment. A phase is not permission to start all its subprojects.

| Order | Bounded outcome | Exit condition / why here |
|---|---|---|
| 0 | Finish reviewed #489; complete private Custom release gates | Exact-head checks/merge and deployment verification, real creator→owner→friend QA, WAF enforcement/reversal, physical mobile, rollback. Flags stay OFF until all gates pass. |
| 1 | One coherent Daily/Custom play-and-finish experience | Small separate web PRs for first-use help, result/share hierarchy, then shared shell/Custom completion presentation. Check 320–430px layouts, keyboard and screen-reader flows; preserve protocol and scores. Can be designed while access is blocked; must not replace missing launch evidence. |
| 2 | Make Daily a reliable permanent product | Resume #434 only after Custom launch and its own review. Complete approved issued-length/editorial work, recognizable lineup calibration, explicit final rules/launch epoch, immutable archive and correct history semantics. Gather basic funnel/latency evidence before broad promotion. No global conversion of old nine-player records. |
| 3 | Optional accounts and reliable unified history | Google/Apple/email direction remains; own internal user ID, explicit authorized association with server results, privacy/deletion rules, no beta auto-import. Anonymous play remains first-class. Accounts earn their place through sync/ownership, not an entrance gate. |
| 4 | Curated public Custom discovery | Explicit owner-authorized publishing, safe public metadata, moderation/reporting, quotas and honest low-volume rankings. Start with a bounded curated directory before algorithmic feeds and more competitive surfaces. Private links remain private/unindexed. |
| 5 | Asynchronous Head-to-Head, Open Pitching first | A separate match contract and adversarial turn/queue/retry tests using the existing Classic engine. Real-player hidden selections, not physical pitch types. Add pool variants only after exact eligibility facts and match authority work. |
| 6 | Native clients and opt-in reminders | Demonstrated returning demand and stable server APIs. Reuse domain rules/contracts; replace web credential/storage adapters. Reassess native value and distribution costs before choosing implementation. |

**Recommended sequencing adjustment:** bring the basic daily habit—clear resume/completion, sharing, content quality and measurement—forward. Accounts and Discover should not be prerequisites for making the existing game enjoyable. More elaborate streaks, badges and notifications can follow reliable history; a public directory should not precede a satisfying private invitation loop.

## Small PR boundaries after release work

1. Returning-player help: `components/DailyHowToDialog.tsx`, `dailyHowTo.ts`, owning tests and blueprint. Version the tutorial-seen preference by relevant rules, not daily date. Test first visit, revisit, explicit help and denied storage. Do not touch gameplay storage/attempt authority.
2. Daily completion hierarchy: `components/GameCompleteView.tsx`, `DailyShareCard.tsx`, their CSS/tests and blueprint. Move score/share up; collapse optional analysis. Preserve exact engine share text and answer exclusions. No comparison API change.
3. Consistent Custom presentation: `custom/CustomLineupGame.tsx`, `CustomLineupScorecard.tsx`, `CustomLineupTerminalPanel.tsx`, `custom-lineup.css`, narrow shared visual pieces and blueprint. Split if a new share/result API is actually necessary. Do not merge Daily and Custom controllers.
4. Creator success/friend handoff: existing `CustomLineupShareLink.tsx` and creator view. Improve separation/copy clarity without changing issuance. #471 response-loss semantics require a separate scope.

One change at a time; review the diff against that outcome. No refactor-only sweep and no new design-system package.

## How to tell whether this helps

Start with a small baseline, not arbitrary growth targets: game opens→first accepted action, accepted starts→completions, abandonment by batter, share-button invocation/copy success, creator success→friend challenge start, and returning-browser visits where privacy-safe measurement permits. Segment Daily/Archive/Custom and new/returning sessions. A share click is not a delivered message; anonymous browser counts are not unique people; a custom link's friend start is not proof of a particular social relationship.

Use existing accepted-result data for authoritative completion counts. Review existing analytics before adding events, and exclude credentials, owner codes, query strings containing secrets, player answers and raw IPs. Browser return cohorts are limited by storage deletion/device changes; do not add persistent identity merely to improve a metric. Watch API latency/errors and incorrect admission as guardrails.

Run a small observed usability pass with new and returning baseball fans: can they explain hint cost, submit a guess, recover after refresh, share without spoilers and distinguish the friend link from the owner code? Let observed failures guide polish. Reassess leaderboard/promotional placement only after the simpler flow is measured.

## GPT-6 continuation

First execute the existing bounded #489 exact-head CI/Preview/merge/production handoff. This review does not bypass outstanding QA/WAF/mobile/rollback gates or authorize later features. Then finish accessible launch evidence. When the release checkpoint permits UX work, start **only the returning-player help PR** above; read current main/canonical docs and promote that specific recommendation into the blueprint. Do not implement this entire roadmap in one session.

Browser-only remainder is unchanged: secure QA credential provisioning, authenticated Vercel Firewall access where needed, real hosted/native-device acceptance and witnessed rollback. No such operation was completed by this review.
