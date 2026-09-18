# Reconcile PR #171 production handoff

Status: Complete  
Date: 2026-09-18

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

## Production proof completed

- A fresh real-browser Daily #144 / `points-v3` session completed with nine Give Ups.
- The browser-originated request created exactly one `public.daily_completed_results` row with the expected puzzle/ruleset identity, nine ordered native facts, and engine-derived zero-point summary.
- The provider receipt timestamp was `2026-09-18 06:16:47.384891+00`.
- The exact persisted schema-1 payload was replayed with the same `submissionId` through production `POST /api/daily/results` using the existing private `pg_net` transport.
- The replay returned HTTP 200 with `{"status":"existing"}`.
- Row count remained exactly one and the original receipt timestamp did not change.
- Vercel reported no runtime errors in the surrounding verification window.

The 4C operational gate is satisfied. 4D Daily Nine comparison may begin.

## Out of scope

- aggregate/comparison implementation or UI;
- accounts or cross-device identity;
- stronger anti-cheat;
- result schema/API/provider/client changes;
- retroactive submission of old completions;
- archive/history work.

## Acceptance

Complete. Canonical handoff/roadmap docs now record both exact production deployment and the successful browser-originated completion/idempotency proof. 4D is unblocked.
