# Durable anonymous Custom creation budget

## Scope contract

- Goal: Provide one atomic, private creation-budget reservation before the upcoming no-sign-in Custom creator can materialize or issue a challenge.
- Owning layer: Supabase persistence/security boundary.
- In scope: One additive private counter table, service-role-only security-invoker RPC, rollback-only QA fixture, canonical contract and operational docs.
- Out of scope: Public routes/UI, trusted-IP parsing/HMAC adapter, gameplay rate limits, new services, accounts, score rules, challenge/result modifications, public activation.
- Acceptance: Isolated hosted SQL fixture verifies exact thresholds, independent clients, global ceiling, expired cleanup, malformed input and permissions; inspect serialization/lock order; independent bounded review; exact-head CI/READY Preview; after merge apply/read back only the additive schema and recheck production state.
- Stop conditions: Changes to game tables, public database grants, external dependencies or live public creation require a separate PR.

## Decision and boundary

The owner chose **no required sign-in** on October 18. Accounts and cross-device ownership/history remain later. Existing challenge-scoped creator cookies remain preview/exclusion provenance, not human identity.

The public Web issuer must reserve budget before expensive player materialization/immutable issuance. It derives a 64-lowercase-hex HMAC digest from a verified platform client IP, current UTC date and a server-only domain-separated secret; never accept browser-provided digests or trust arbitrary forwarded headers. Missing trusted IP/configuration/provider fails closed. The adapter and public issuer are the next bounded PR, not implemented here.

Initial conservative budgets: **10 creation attempts per IP digest per 10-minute fixed window**, and **1,000 admitted creation attempts globally per UTC day**. Invalid/failed issuance after a successful reservation is not refunded. Quotas are abuse/cost controls, not unique-human enforcement; shared networks can reach the same limit. The global cap bounds distributed issuance even when IPs rotate. Threshold changes require a reviewed migration.

The database chooses time/windows after acquiring one stable transaction advisory lock (`1768055618,1129660977`). This lock covers all date windows, counter writes and cleanup; per-day locking alone would permit a cleanup/reservation deadlock across midnight. Denials do not increment accepted counts or add unlimited client rows. Expired counters are deleted on the next reservation; no raw IP, account identifier, browser fingerprint, challenge ID or selected player is stored. If traffic stops, the final expired rows remain until the next reservation; this is explicit retention, not a timed-deletion guarantee. The service-role-only invoker RPC uses an empty search path; RLS denies browser roles.

This primitive does not protect gameplay reads/writes or make creation public. The coordinated Vercel edge limit and live browser/mobile/v1/privacy/activation gates remain required. Current Hobby documentation allows one WAF rate-limit rule/project; no paid upgrade or firewall configuration is made here.

## Draft checkpoint at owner-requested chat handoff

Single-session rollback fixture passed on isolated QA after applying this additive migration as hosted version `20261018192340` (the CLI-created source filename has a different timestamp; reconcile per environment, do not blindly replay). QA budget rows remain zero. Production schema is untouched. Independent review identified the cross-midnight cleanup deadlock in an earlier per-day-lock draft; the final source uses one stable advisory transaction lock and chooses time after acquisition. The actual service-role allow/deny paths are included in the passed fixture.

An attempted multi-session contention probe did not observe the held advisory lock through the connected SQL tools and consequently did not establish concurrent execution; its expected-contention assertion failed. This is **not** a passing concurrency test. Before merge, verify contention/rollover serialization with genuinely independent database connections, and confirm the bounded review finding is resolved. No second full review is needed. Baseline typecheck/lint, source whitespace and file-size checks passed; exact-head PR CI and READY Preview remain required. The owner requested a natural stopping point; preserve this as a draft until the remaining checks pass.

## Subsequent verified completion

PR #439 merged as `6cb676e` after exact-head CI SUCCESS and Preview READY. A local PostgreSQL 18 sandbox with genuinely distinct database processes observed 10 approvals and 22 denials from 32 parallel same-digest requests, both counters at 10. A separately observed advisory lock blocked another reservation for 3,923ms until release. The stable lock and post-acquisition clock ordering address the cross-midnight lock-order concern, but no real midnight transition was exercised. Production hosted migration `20261018193404` installed reviewed SQL; RLS/grants verified, zero counters, no production fixtures. This completion supersedes the historical draft blocker above. The Web adapter is a separate PR.
