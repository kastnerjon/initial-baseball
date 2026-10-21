# Hosted Vercel ingress verification — Custom Lineups

## Scope and evidence

- Date: October 20, 2026 (New York); API response timestamps may be October 21 UTC.
- Production main at start/end of probe: `4b809fcd3ae98e9f56b87ee4e56e5225dadc16e2` (READY). Public Custom creator remains **OFF**.
- Ephemeral **draft** PR [#466](https://github.com/kastnerjon/initial-baseball/pull/466), commit `0982170cdbddbd6ee31ee472e9be7e853b655f1d`, exact-head Vercel Preview READY; **closed without merge** after testing.
- Preview-only GET route `/api/custom-lineup/edge-probe` required `VERCEL=1` and `VERCEL_ENV=preview`. It reused `verifiedVercelCreationIp` from existing server code. It returned **booleans only**, not originating IPs, secrets, cookies or owner codes. No Supabase calls or mutations.
- Purpose: verify **actual Vercel ingress** for the currently deployed project and route instead of trusting locally simulated forwarded headers. This is a bounded platform check, not a complete public release.

## Exact test cases and results

Through an authorized, protected Preview link, seven external requests were sent via the Vercel edge:

| Case | HTTP | Valid single forwarded IP | Vercel/XFF and real-IP agreement | Spoof sentinel rejected | Existing quota IP parser |
| --- | --- | --- | --- | --- | --- |
| Ordinary request | 200 | yes | yes | yes | accepted |
| Forge `x-forwarded-for: 203.0.113.79` | 200 | yes | yes | yes | accepted |
| Forge both `x-forwarded-for` and `x-vercel-forwarded-for` | 200 | yes | yes | yes | accepted |
| Forge comma-separated `x-forwarded-for` chain | 200 | yes | yes | yes | accepted |
| Forge `x-real-ip: 203.0.113.79` | 200 | yes | yes | yes | accepted |
| Forge `x-vercel-forwarded-for: 198.51.100.79` | 200 | yes | yes | yes | accepted |
| Inject invalid `x-forwarded-for: attacker.invalid` | 200 | yes | yes | yes | accepted |

All seven additionally reported `previewOnly=true` and `edgeRequestIdPresent=true`. RFC 5737 documentation ranges were used for harmless forged values. No actual client addresses were recorded. The temporary route was never merged into `main`.

**Conclusion:** The tested Vercel Preview ingress overwrote/rejected those forged forwarded-address inputs, and the existing Custom creation IP validator accepted the resulting edge-provided values. This **clears the limited real-ingress spoof-resistance check for this Preview**, without establishing production behavior in every region, continuous provider guarantees, WAF enforcement or any end-to-end Custom gameplay.

## Separate QA Supabase evidence

On the isolated QA Supabase project, seven existing rollback-only regression scripts executed successfully on October 20, 2026: `custom_lineup_creation_budget.sql`, `custom_lineup_v2_issued_challenges.sql`, `custom_lineup_v2_attempt_lengths.sql`, `custom_lineup_v2_atomic_completed_admission.sql`, `custom_lineup_v2_comparison_buckets.sql`, `custom_v2_issued_title.sql`, `custom_v2_owner_capability_digest.sql`. This includes the budget behavior of ten allowances in a window, the 11th denial, and independent other-client admission. All fixture mutations were rolled back; the QA budget table was verified empty afterward. Both QA and production Custom tables have RLS enabled and disallow direct `anon`/`authenticated` SELECT and INSERT. No production SQL mutation was performed.

## Remaining release gates — do not enable public creation

1. **Real HTTP creator → owner code → friend play → signed completion** against isolated QA Supabase: the hosted harness exists, but still needs securely provisioned **QA-only** service-role credentials in a disposable environment; do not paste secrets in chat or point the harness at production.
2. **WAF / rate protection**: October 21 Vercel project API metadata showed SSO protection enabled for non-custom domains, with password protection and Trusted IP protection disabled. No project setting was changed. The active custom firewall-config endpoint returned `404 Seawall Config not found`, so no WAF policy has been verified. The connected team metadata does not report its plan, and the authorized browser reaches a Vercel sign-in page. Vercel's current documentation says custom firewall rules are available on all plans, while WAF rate limiting is Enterprise-only ([custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules), [usage and pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing)). Confirm the team's entitlement in the authenticated dashboard. If rate limiting is available, stage a route-scoped rule only for `POST /api/custom-lineup/create`, first in log-only mode if supported; verify controlled real-edge behavior before enforcement. Roll back by disabling the rule and publishing the staged firewall configuration, then verify requests no longer match. Do not weaken deployment protection. If the plan does not include rate limiting, the tested server-side creation quota remains a separate defense; it does not prove WAF enforcement.
3. **Physical mobile and rollback checks**: iOS Safari and Android Chrome, complete creator → share → friend exercise, cookie/owner behavior and rollback drill. The localhost Chromium UI acceptance for N=1–10 and six widths passed separately; it does not replace physical devices.

No production flags, WAF rules, Supabase schema or gameplay behavior were changed during this ingress study.

## October 21 follow-up

Connected Vercel project metadata confirmed the existing deployment-protection settings above. The authenticated dashboard was not available in the browser session, so the account plan, rule editor and traffic analytics could not be inspected. An active firewall-config read still returned `404 Seawall Config not found`. The official documentation identifies rate limiting as an Enterprise-only feature; therefore no WAF rule was staged, and no claim of enforcement is made. This is an access/entitlement verification blocker, not evidence that the production firewall is disabled.

## Review and documentation impact

This permanent note replaces ephemeral probe code; the probe was intentionally **closed unmerged**. Evidence is limited to the exact preview, timestamp and cases above. Update `docs/START-HERE.md` and `tasks/todo.md` accordingly. No new product or architecture contract, package dependency, runtime behavior, or migration is introduced by the documentation PR.
