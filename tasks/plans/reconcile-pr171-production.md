# Reconcile PR #171 production handoff

Status: Active operational reconciliation  
Date: 2026-09-17

## Goal

Record the verified production state after native completed-result activation merged, while keeping the remaining real-browser collection/idempotency proof explicit and blocking comparison work until it passes.

## Verified state

- PR #171 merged as `ae2fc428b2fad05685b068944acce66b9dddf536`.
- Final PR head `8967b6d5145552613b2d3436e8395100848d45b3` passed GitHub CI run #620, including typecheck, full tests, file-size checks, canonical baseball-data generation/QA, documentation-impact, and production package build order.
- Exact-head Vercel preview `dpl_9yGJDjnmyWYRLb2XjeAL4rLjkVZY` is READY.
- Exact merge-SHA production deployment `dpl_DctrheRJbonPmcszrjAfPuJxvzhy` is READY with no alias error.
- The canonical production URL returned HTTP 200 and served Daily #144 from the merged build.
- Vercel reported no runtime errors in the first-hour scan after deployment.
- `public.daily_completed_results` contained zero rows immediately after deployment, as expected before a fresh browser completion.

## Remaining operational gate

Before starting 4D comparison work:

1. complete one fresh native Daily Nine or Classic session in a real browser;
2. read back the persisted `daily_completed_results` row and confirm the expected puzzle/ruleset identity;
3. exercise an identical same-`submissionId` retry;
4. confirm the retry returns/retains the existing result and total row count does not increase.

The connected read-only web fetch path can verify the live app and deployment but cannot perform browser clicks or POST gameplay actions, so this last proof remains explicitly pending rather than being simulated through direct database writes.

## Out of scope

- aggregate/comparison implementation or UI;
- accounts or cross-device identity;
- stronger anti-cheat;
- result schema/API/provider/client changes;
- retroactive submission of old completions;
- archive/history work.

## Acceptance

This reconciliation is complete when canonical handoff/roadmap docs state that PR #171 is deployed and healthy, while the live browser completion/idempotency proof remains the sole blocker before 4D.
