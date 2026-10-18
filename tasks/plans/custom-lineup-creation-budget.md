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

## October 18 follow-up: database-authoritative day validation

The independent #440 code reviewer found a midnight/clock-skew bypass in the
original Web budget protocol: a request could sign yesterday's IP digest, wait
behind the database lock until after midnight, and reserve today's bucket with
a different key from following requests. The unchanged global day ceiling
does not enforce the intended same-IP 10-in-10-minutes limit in that case.

The follow-up database-only migration replaces the unused, service-role-only
one-argument RPC with a two-argument reservation accepting the *server-signed
digest's claimed UTC day*. Under the same stable advisory lock, after
capturing database time, the RPC rejects a mismatch without inserting or
incrementing any counters and returns the authoritative day in a
machine-readable response. The Web adapter must retry after deriving an HMAC
for that returned database day; it must never trust browser-submitted dates.
Regular admission and quota denial also return the DB day. Removing the old
single-argument signature prevents stale servers from silently skipping the
new check. No public callers or feature activation exist at this stage.

Updated `supabase/tests/custom_lineup_creation_budget.sql` uses the new
signature and asserts both the no-consumption mismatch and the regular
10/window and global/day limits in one transaction rolled back. Local
PostgreSQL 18 checks additionally verified service-role-only EXECUTE,
SECURITY INVOKER, malformed days and unchanged counter constraints. Actual
UTC-midnight passage still requires end-to-end controlled QA; neither
production activation nor public creator endpoint is authorized here.
