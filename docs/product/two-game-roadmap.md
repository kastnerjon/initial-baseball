# Initial Baseball: Daily Inning and Head-to-Head

Status: Approved product direction; implementation remains staged  
Decision date: 2026-10-04

## Vision and current baseline

One baseball product with two experiences, shared accounts, canonical player data, and a baseball-card visual identity:

- **Daily Inning:** a short daily challenge, sharing, archive play, and score comparison.
- **Head-to-Head:** asynchronous baseball games with friends, multiple active matches, turn notifications, and rivalry records.

Daily Inning is the product-direction name used in this discussion. The current public game is named **Daily Nine** and uses `points-v4`. This roadmap does not rename it, change its scoring, or restore the hidden Classic Inning route. Head-to-Head is a new multiplayer experience, not a rename of Classic.

The owner considers the daily game mechanically functional and its interface/look and feel the main product gap. Existing archive work includes immutable puzzle storage, issuance/read/runtime seams, and browser save isolation; the public archive experience remains unfinished. PR #289 is an existing separate archive-composition concern. Verify its live status before continuing implementation; this document does not merge it or activate issuance.

The new direction supersedes earlier statements that Head-to-Head/native clients were merely hypothetical. It does not supersede current runtime contracts, permanent Daily #1 activation requirements, or the one-concern-per-PR process.

## Two experiences

| Dimension | Daily Inning | Head-to-Head |
| --- | --- | --- |
| Reason to return | Daily ritual and shared challenge | Ongoing games and rivalries with friends |
| Content | Curated daily lineup | Opponent chooses from the match's allowed player pool |
| Pace | Short session | Turns throughout the day |
| Competition | Daily scores and leaderboards | Wins/losses and records against each friend |
| Replay | Archive of prior daily challenges | Multiple concurrent matches |
| Platform | Polished mobile web first | App-based destination; web may complement it |

## Baseball-card presentation

Use a mystery baseball card as the central at-bat presentation. Revealing a hint progressively exposes the relevant section of the card back: positions, teams, years, or supported stats. Clearly distinguish each newly exposed clue. At terminal resolution, reveal the player's identity/card front, whether the batter succeeded or struck out.

The card presentation must preserve existing clue order, authorization, stat accuracy, responsive search/guessing, immediate hint interaction, and spoiler-safe sharing. Keep the answer absent from unresolved batter-facing payloads and rendered/hidden card surfaces. Support reduced motion and readable phone layouts; animation must not delay a turn or make clues harder to read.

Begin with original card artwork and a coherent visual system. The owner's long-term commercial aspiration is partnerships with Topps or other card companies if the game gains traction. No partnership, licensed asset access, or commercial arrangement is established by this plan. Keep the presentation capable of accommodating future licensed artwork without making the first release depend on it. Collecting/trading cards is not an approved feature here.

## Daily archive

Finish the public browse-and-play experience over the existing archive foundation rather than rebuilding it. Show stable Daily identities, clear completion status, recorded results, and links back to today's game. Preserve current-Daily/archive save isolation and immutable published lineups/clues.

The permanent archive still starts at an explicitly authorized permanent Daily #1 epoch. A pre-launch archive-beta series remains separately fenced; this roadmap neither selects its epoch nor authorizes a first hosted issue, beta-history import, or permanent launch reset. Initially retain browser/device-local history; shared accounts later enable cross-device history through a separately reviewed migration and ownership policy.

Archived scoring/comparisons must follow explicit supported game/ruleset policy. This planning change does not rewrite historical results, combine incompatible populations, or change current archive scoring contracts. Decide replay/leaderboard eligibility before ranked archive or repeat play is launched.

## Shared accounts and leaderboards

Keep daily play available without signing in. Introduce lightweight sign-in for saved history, leaderboard participation, and friend relationships. Email-based entry or another comparably easy method is desired; the authentication provider and exact flow remain open.

Use the same account identity across Daily Inning, Head-to-Head, web, and the eventual app. Keep private email/account identifiers separate from public display names. Existing anonymous aggregate-result records are not verified account identities or a ranked competition system.

Before implementation, settle first-attempt/replay/reset eligibility, ties, daily cutoff, ruleset partitioning, public display/privacy, and how eligible results are validated and claimed by an account. Do not rank client-submitted totals without authoritative validation. Keep ranked account results distinct from existing anonymous population averages and test/reset traffic.

Start with daily score competition. Global versus friends-only views, cumulative rankings, streaks, and archive rankings remain open scope decisions.

## Head-to-Head: confirmed gameplay

1. One friend pitches while the other bats.
2. The pitcher chooses a mystery player from the allowed universe for that match.
3. The batter guesses using the at-bat/hint mechanic. Resolution yields a home run, triple, double, single, walk, or strikeout.
4. Resolve the outcome as baseball: advance runners, score runs, and record outs through the portable baseball engine. Reveal the player card after the at-bat regardless of outcome.
5. At three outs, switch pitching and batting sides for the next half-inning.
6. Persist the match so friends can resume throughout the day, with several games active at once and notifications when an action is due.
7. Completed matches contribute to each user's record against that friend.

Head-to-Head is baseball-native rather than a contest to total Daily Nine points. Reuse reviewed pure outcome/runner logic where it fits, but do not inherit Classic's nine-at-bat cap as a multiplayer half-inning rule: the confirmed side-switch condition is three outs. Define match completion separately.

## Match player universe

Allow match settings to narrow the selectable players so a pitcher cannot default to arbitrary obscurity. Recommended initial design: a curated recognizable default pool plus optional presets such as modern players, all-time players, or selected eras. Preset definitions, eligibility thresholds, and any team filters still need design/playtesting.

Both friends agree to the settings at match creation. Freeze an explicit pool/data version and rules version for that match. Validate pitcher selections against that pool on the authoritative server. Decide player reuse/cooldowns and how to handle unavailable players before launch; a data refresh must not silently change an active match's rules or answer identity.

## Architecture direction

- Keep canonical identity, facts, aliases, and pool inputs in `packages/baseball-data`.
- Keep portable baseball outcomes, runner advancement, and rule derivation in `packages/engine`; stable versioned contracts belong in `packages/shared`.
- Preserve independent Daily and Head-to-Head orchestration/state. Daily identities, completed-result populations, and multiplayer matches must not be conflated.
- Accounts, friendship/invitations, authoritative match persistence, and notification delivery use explicit service/repository/platform boundaries. Database and device APIs stay outside pure rules.
- Authorize each multiplayer action for the current role/turn. Use match revisions and idempotent action identities to reject stale, duplicate, or out-of-turn actions; award a completed match to rivalry records once.
- The pitcher necessarily knows the selected answer; the unresolved batter must receive only authorized clues. Existing anonymous Daily tokens/result validation alone do not establish multiplayer turn ownership.
- Derive reusable card presentation from authorized display data. Share visual conventions and portable contracts across web/app without forcing web components into native clients.
- Persist accepted match transitions before delivering notifications. Notification failure must not lose or replay an accepted turn; exact retry/delivery infrastructure is a later bounded decision.
- Keep gameplay responsive and preserve independently deployable mode boundaries. Add packages, queues, providers, or frameworks only when a concrete implementation checkpoint requires them.

## Staged delivery and acceptance

This is the strategic sequence after current bounded blockers/checkpoints; it does not expand PR #289 or authorize an implementation bundle. No delivery dates are committed.

| Stage | Scope | Exit evidence |
| --- | --- | --- |
| 1. Finish Daily presentation | Mobile UX, card visual system, hints, guesses, reveal, results, sharing | Playable phone layouts; immediate clues/results; reliable restore; no spoilers in unresolved/share surfaces |
| 2. Public archive | Browse, stable routes, play/resume, local completion/history | Frozen content loads correctly; archive/current saves remain isolated; launch/series decisions are explicit |
| 3. Accounts and daily competition | Easy sign-in, history ownership, eligible ranked results | Cross-device identity/history works; replay/tie/version rules are documented and validated |
| 4. Head-to-Head prototype | Invitations, opponent selection, baseball turns, active-game list, rivalry records | Two accounts can play/resume a complete match; three-outs side switch works; duplicate/stale actions cannot advance it twice |
| 5. App experience | Shared accounts, turn inbox, push notifications, quick resume | Notification opens the correct match/action; several games remain coherent across devices and interrupted sessions |

Validate whether the card design improves clarity/enjoyment and whether friends voluntarily continue asynchronous matches. Use that evidence to prioritize polish and app investment. A mobile-web prototype can validate multiplayer before the app; the desired destination includes an app and is not web-only.

## Open decisions before the owning implementation

- Public Daily name and final launch scoring/epoch; existing Daily Nine remains unchanged meanwhile.
- Exact card layout, reveal animation, approved image sources, and whether identity reveal flips the card.
- Authentication method/provider, guest-history migration, account recovery, and public display/privacy defaults.
- Leaderboard eligibility, first attempts/replays, ties, cutoffs, friends/global views, and ranked integrity expectations.
- Head-to-Head outcome mapping from hints/wrong guesses, Give Up treatment, and any sacrifice behavior; the six listed outcomes are the confirmed concept, not a new implemented ruleset.
- Match length (innings), home/away assignment, ties/extra innings, final/walk-off conditions, forfeits, and inactivity policy.
- Granularity of an asynchronous turn: pitcher selection and batter response are required actions, but whether each hint/guess or the whole at-bat yields control/notifications remains open.
- Player-pool presets/thresholds, repeat restrictions, and pool/data version policy.
- Invitation/discovery flow, notification channels/permissions/preferences, and app platform/framework.

Resolve each decision in the appropriate narrow plan before coding it; record confirmed direction separately from implementation and hosted verification.
