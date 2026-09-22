# Daily Nine active-at-bat prefetch verification — September 22, 2026

Status: #227 post-merge hosted/source checkpoint closed; ordinary-browser request-count/latency and physical-mobile interaction remain open

## Scope contract

- **Goal:** record exactly what the hidden active-at-bat comparison prefetch is proven to do after PR #227, and separate that evidence from browser/mobile behavior that has not been observed directly.
- **Owning layer:** repository engineering verification/documentation.
- **In scope:** exact GitHub main/CI state, exact Vercel production deployment identity and aliases, live comparison-route HTTP behavior, exact-deployment error/fatal logs, source/test inspection of prefetch identity/presentation/invalidation, current browser-tool capability, and the remaining acceptance matrix.
- **Out of scope:** runtime code changes, comparison semantics changes, Supabase schema/RPC work, SQL/index/rollup/cache work, scoring changes, puzzle loading, browser telemetry, scorecard/share AVG, or onset-of-AB AVG display.
- **Acceptance checks:** exact main and open-PR state verified; push CI run #35769178567 inspected; production deployment `dpl_AqF96Fs2HvmfQ6NXatUZ2ZsPEen1` verified on exact merge SHA; both public comparison routes return versioned HTTP 200 with `private, no-store`; exact deployment has no error/fatal runtime logs in the reviewed window; implementation and existing tests are inspected against the acceptance matrix.
- **Stop conditions:** any finding that requires runtime behavior, storage, scoring, transport, or presentation changes becomes a separate bounded PR.

## Exact post-merge checkpoint

PR #227, **Prefetch Daily Nine at-bat comparisons**, is merged as:

`a62b35616a85223d5780fbc26192456dcdbe13e9`

Verified after merge:

- GitHub `main` resolves to that exact SHA.
- No pull requests are open.
- Push CI run `35769178567` completed. The executable `test` job concluded `success`, including dependency install, typecheck, unit tests, file-size checks, baseball-data audit/generation/QA and production package build-order verification. The push-run `documentation-impact` job was skipped rather than failed.
- Production deployment `dpl_AqF96Fs2HvmfQ6NXatUZ2ZsPEen1` is `READY`, targets production, and reports Git commit SHA `a62b35616a85223d5780fbc26192456dcdbe13e9`.
- The deployment has the canonical aliases `initial-baseball-web.vercel.app`, `initial-baseball-web-kastnerjons-projects.vercel.app`, and `initial-baseball-web-git-main-kastnerjons-projects.vercel.app`; `aliasError` is null.
- The exact deployment's error/fatal runtime-log scan for the reviewed 24-hour window returned no matching logs.
- No Supabase migration verification was required because #227 changed only the web consumer.

## Live comparison-route check

The canonical production alias was queried after #227:

- `GET /api/daily/comparison/at-bat?date=2026-09-22&ruleset=points-v3&pitch=1` returned HTTP 200, schema version 1, kind `at-bat`, and `Cache-Control: private, no-store`.
- `GET /api/daily/comparison/completed?date=2026-09-22&ruleset=points-v3` returned HTTP 200, schema version 1, kind `completed`, and `Cache-Control: private, no-store`.

The retained at-bat probe reported Daily #149 pitch 1 with 2 received observations and average 7. The retained completed probe reported 1 completed result and average total points 38. These values are only a route-health snapshot; they are not product acceptance thresholds or a new comparison semantic.

The returned `Server-Timing` values continued to show the existing provider/RPC diagnostic seam. This verification does not reopen the provider diagnosis recorded in `docs/engineering/daily-nine-comparison-server-timing-2026-09-22.md`.

## What source and automated tests prove

Inspection of current #227 source confirms:

1. **Hydration gate.** `DailyInningGame` passes null to the at-bat comparison hook until `hasLoadedSavedState` is true, preventing a throwaway initial-slot read before durable state is hydrated.
2. **Exact active identity.** `createDailyNineAtBatComparisonInput` creates the points-v3 comparison key from puzzle ID/date/number, ruleset and pitch number while the AB is still active. `ownPoints` is separate and nullable.
3. **No terminal-identity restart by design.** The hook's request effect depends on puzzle/ruleset/pitch identity and deliberately excludes `ownPoints`. Existing tests also show the active and terminal input use the same comparison key.
4. **Hidden active presentation.** `createDailyNineAtBatComparisonState` returns public `idle` while `ownPoints` is null even if hidden read state has already succeeded or failed. `AtBatCard` renders comparison only in its resolved-terminal branch. Static-render coverage explicitly verifies that a success-shaped comparison object does not expose AVG/count markup during active play.
5. **Quiet failure projection.** Once own points exist, hidden unavailable state projects to the existing terminal `unavailable` state rather than blocking gameplay.
6. **Stale-response authority remains centralized.** `createDailyNineComparisonRequestController` still owns same-channel replacement, abort and generation/request fencing. Its existing tests cover late success suppression, late failure suppression after invalidation, independent at-bat/completed channels and session-wide invalidation.
7. **Semantic transitions invalidate synchronously.** `DailyInningGame` explicitly invalidates the at-bat comparison before Next, Reset and saved-game restore change semantic identity.

These are meaningful correctness checks, but they are not substitutes for a network trace from a real browser.

## What is not yet directly proven

The following remain open:

- an ordinary-browser trace showing exactly one at-bat comparison GET across active play → terminal own-points projection;
- ordinary-browser trigger-to-visible timing with active prefetch live;
- deliberately delayed comparison-read behavior observed through the rendered UI;
- deliberately failed comparison-read behavior observed through the rendered UI;
- stale-request behavior observed interactively across Next / Reset / restore rather than inferred from controller tests and source wiring;
- physical/mobile interaction QA;
- physical/mobile answer/spoiler-integrity inspection;
- direct browser evidence that gameplay actions remain responsive while comparison reads are delayed.

## Browser-tool capability at this checkpoint

The current execution environment was re-checked rather than relying on the prior handoff.

- No dedicated `agent-browser` connector/tool is exposed.
- Chromium is installed at `/usr/bin/chromium`.
- Python Playwright is installed.
- The shell cannot resolve the public production hostname, so those local browser binaries cannot navigate the production Vercel site from this environment.
- Vercel's authenticated deployment fetch capability can reach the deployment and is suitable for HTTP-level checks, but it is not an interactive browser lifecycle trace.

Therefore this document does not claim ordinary-browser or physical-mobile proof.

## Acceptance matrix after #227

| Acceptance item | Status | Evidence |
| --- | --- | --- |
| Exact #227 main/CI/deployment identity | Verified | GitHub + Vercel post-merge checks |
| Canonical aliases attached / no alias error | Verified | exact Vercel deployment metadata |
| Public comparison APIs still healthy | Verified | live HTTP 200 schema-1 probes with `private, no-store` |
| Exact deployment error/fatal scan | Verified clean | Vercel runtime logs |
| AVG hidden during active AB | Verified by source/static render test | `createDailyNineAtBatComparisonState` + `AtBatCard` coverage |
| Active and terminal states keep same comparison key | Verified by unit tests/source | comparison-input tests |
| Terminal own-points excluded from request-effect dependencies | Verified by source | hook effect dependency list |
| Stale success/failure callbacks fenced | Verified by unit tests | request-controller tests |
| Next / Reset / restore invalidate current AB comparison | Verified by source | `DailyInningGame` handlers |
| Exactly one GET across active → terminal | Not directly browser-verified | requires browser network trace |
| Trigger-to-visible browser latency | Not verified | requires ordinary-browser measurement |
| Delayed/failed read rendered behavior | Not directly browser-verified | requires controlled browser/network behavior |
| Physical/mobile interaction QA | Not verified | requires device/browser exercise |

## Decision

Do not redesign the comparison backend from this checkpoint. The remaining uncertainty is browser/mobile verification, not SQL/storage/scoring architecture.

When browser-capable evidence is available, collect the remaining lifecycle/request-count/latency proof without putting comparison on gameplay's critical path. Until then, preserve the open verification items explicitly.

Issue #216 remains the next bounded comparison presentation feature: show the existing completed-game AVG on the normal scorecard and spoiler-safe/shareable scorecard without inventing another calculation. Onset-of-AB AVG display remains a separate future presentation-policy decision.
