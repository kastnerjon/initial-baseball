# Custom Lineups — reversible production rollback drill

## Scope contract

- Goal: verify provider-supported reversal of the live production alias between adjacent, previously reviewed READY deployments without enabling Custom Lineups.
- Owning layer: Vercel deployment/release operations and the release acceptance record.
- In scope: preflight exact-SHA/runtime verification, reversible rollback and promotion, canonical route smoke, every production alias, post-drill read-only error/database checks.
- Out of scope: Custom feature-flag activation, production issuance, schema/data rollback, Vercel firewall modifications, authentication/deployment-protection changes, physical-device acceptance.
- Stop conditions: if either build or normal routes are unhealthy, or promotion cannot restore the reviewed latest deployment, keep the known-good reviewed deployment and record the failure rather than improvising.

## Verified October 23, 2026

**Before the drill.** The canonical alias `initial-baseball-web.vercel.app` pointed to `dpl_6bG4qx8ZFFsZaoCiwU6HCuR8fTAY` on `3dc1e0a1c883a73f99ce6920c714256efd8fa2ae` (merged PR #498). The immediately preceding reviewed production, `dpl_BPu4DvhXDvdfJ2M46XBN4rtd5ojx` on `b20cd07620ab757f18bc044e3b7ac9dc8546d6c8` (PR #497), was also READY. The complete #498 diff consisted only of `apps/web/scripts/qa-custom-v2-hosted.mjs`, `docs/START-HERE.md`, `tasks/todo.md` and two Custom QA evidence plans; it changed no served app logic. Protected exact-deployment fetches confirmed HTTP 200 for the root and HTTP 404 for `/create` on both builds. The production runtime-error query returned no recent errors.

**Rollback.** Authorized Vercel rollback targeting `dpl_BPu4DvhXDvdfJ2M46XBN4rtd5ojx` completed. A fresh alias read confirmed the canonical alias pointed to that previous build. Requests through the *canonical alias*, rather than merely its immutable deployment URL, yielded:

| Route | During rollback | After promotion |
| --- | --- | --- |
| `/` | 200 | 200 |
| `/archive` | 200 | 200 |
| `/classic` | 200 | 200 |
| `/results` | 200 | 200 |
| `/create` | 404 | 404 |

**Restore.** Vercel promotion targeting the reviewed current deployment `dpl_6bG4qx8ZFFsZaoCiwU6HCuR8fTAY` completed, and the promotion-alias API reported `completed` for the canonical alias. Fresh readbacks confirmed **all three** production aliases pointed to the current deployment:
- `initial-baseball-web.vercel.app`
- `initial-baseball-web-kastnerjons-projects.vercel.app`
- `initial-baseball-web-git-main-kastnerjons-projects.vercel.app`

**Postconditions.** Read-only Supabase production verification returned 1 Custom issued challenge, 0 attempt states, 0 completions, 0 at-bats and 0 creation-budget rows, unchanged from before the drill. Vercel grouped runtime errors returned none in the one-hour window inspected. This session made no production database writes, WAF edits, feature-flag changes, secret changes or deployment-protection changes.

## Limits and follow-up

This validates deployment **routing** and reversal while public Custom Lineups are disabled. It does not prove active Custom gameplay continuity, enabled-feature rollback, cross-release cookie/attempt schema compatibility, rollback after migrations, zero-downtime performance, or physical browser behavior. The verified current live alias is the `#498` deployment above. Keep both public Custom flags OFF; complete genuine WAF, signed native-hosted browser (#470), physical mobile and #471 product decision before controlled rollout. Any later enabled-feature rollback requires its own scope and data-contract checks. Do not re-run this exercise as a proxy for those gates.
