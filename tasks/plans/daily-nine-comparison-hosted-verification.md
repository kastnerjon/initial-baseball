# Daily Nine comparison hosted verification

Status: hosted/platform evidence recorded; interactive browser/mobile verification remains
Date: 2026-09-20

## Scope contract

- **Goal:** establish an exact, reproducible hosted checkpoint for the merged Daily Nine comparison browser consumers before changing runtime behavior.
- **Owning layer:** repository QA/documentation.
- **In scope:** verify current GitHub main/open PRs/CI; verify the exact production Vercel deployment and recent comparison-route/runtime health; verify the hosted Supabase comparison migration/RPC access posture; compare exact-main Next build and hidden-answer output with the immediately preceding comparison checkpoints; reconcile canonical docs; record what remains unverified.
- **Out of scope:** runtime instrumentation, analytics frameworks, retry/backoff/caching changes, rollups, database/schema changes, scoring changes, React/UI changes, Classic comparison, unrelated refactors, and any claim of physical/mobile verification that did not occur.
- **Acceptance checks:** every recorded hosted claim is tied to an exact SHA/deployment/run or hosted query; canonical docs no longer say browser comparison is unimplemented; open interactive gates remain explicitly open; final diff is documentation/evidence only.
- **Stop conditions:** a verified runtime/product defect becomes its own bounded implementation PR; inability to obtain physical/mobile evidence does not justify inventing it or adding telemetry without a separate design decision.

## Why this checkpoint is separate

PRs #208 and #209 intentionally added browser consumers without adding a generic observability system. The next question is empirical: whether the live feature is responsive and inert when stale or unavailable. Before considering new instrumentation, preserve a clean exact-main baseline using evidence already available from GitHub, Vercel, Supabase and build QA.

This checkpoint does not alter the browser, server, provider, persistence or scoring architecture.

## Recorded evidence

The durable evidence is in:

- `docs/engineering/daily-nine-comparison-hosted-verification-2026-09-20.md`
- `docs/engineering/daily-nine-comparison-server-timing-2026-09-22.md`

The September 20 evidence covers exact-main CI/production identity, recent runtime route health, Supabase migration/RPC privilege posture, build-size deltas and hidden-answer QA. The September 22 evidence adds the first 20-sample-per-route production handler distribution from the PR #221 `Server-Timing` seam. It shows fast medians but material handler long-tail variance and leaves ordinary-browser p50/p95 open.

## Remaining interactive gate

Still required before comparison is called fully browser/mobile verified:

1. observe terminal outcome/player reveal and YOU / AVG on common mobile widths;
2. measure trigger-to-visible comparison latency over enough samples to describe p50/p95 honestly;
3. decompose handler long-tail time between authoritative-puzzle loading and comparison-provider work, then separate browser/network/server/provider contributions where current evidence permits;
4. confirm the ninth completed read starts before View Results and is not restarted solely by that transition;
5. confirm restored completion reads current comparison data;
6. inspect request counts, including development Strict Mode where applicable;
7. exercise delayed/failed comparison reads and confirm Next At Bat, View Results, final results, sharing and write delivery remain usable;
8. exercise rapid Next, reset, restore and navigation/unmount to confirm stale reads remain inert;
9. recheck client/network payloads for hidden answer/player data;
10. inspect the final YOU / AVG / BEAT layout at common iPhone CSS widths.

If those observations expose a code defect, fix that defect in a separate bounded PR. The missing server-boundary timing datum is now addressed by the bounded comparison `Server-Timing` seam in `tasks/plans/daily-nine-comparison-server-timing.md`; it still does not replace the required real-browser trigger-to-visible samples or justify a generic analytics framework.

## Documentation impact

This plan, its evidence record, START-HERE, todo, the architecture plan and the resolved-at-bat comparison roadmap are reconciled together.
