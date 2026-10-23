# Custom QA negative ingress through Next.js

## Scope contract

- Goal: Run the isolated public creator acceptance suite without mistaking Next.js's synthesized forwarding header for absent ingress.
- Owning layer: `apps/web/scripts` QA harness.
- In scope: Explicitly empty simulated forwarding headers in the negative ingress request; actual Next production-server regression against designated isolated QA; record fixture counts and acceptance evidence.
- Out of scope: Application IP trust rules, quota policy, credentials in source, database migrations, WAF edits, production activation, browser/device acceptance.
- Acceptance: Existing runner startup/origin tests; full isolated-QA public creator/friend suite; independent CodeRabbit review; exact-head CI and Preview before merge.
- Stop: Do not weaken app guards or runner provenance. Real Vercel, physical devices and rollback remain independent release gates.

## Confirmed failure

On main `b20cd07620ab757f18bc044e3b7ac9dc8546d6c8`, actual Next.js 15.5.15 startup with QA-only credentials reached the negative ingress assertion and returned 201 instead of 503. Next's `base-server.js` populates an absent `x-forwarded-for` from the socket. The runner deliberately simulates `VERCEL=1` for this local process, so omission does not reach the route as missing ingress.

Send explicitly empty `x-forwarded-for` and `x-vercel-forwarded-for` in this negative fixture. Next's nullish assignment preserves the empty value and the existing application parser rejects it. This validates unusable ingress at the application boundary; it cannot prove real Vercel header authenticity.

## October 23 actual acceptance evidence

The corrected runner passed against the real isolated QA Supabase project using a locally built Next.js production server. All N=1–10, third-strike/Give Up, hidden-answer checks, separate owner capability, creator exclusion, hint/strike restore, signed token replay rejection, first completion admission and duplicate completion passed. Serial quota admitted ten, denied the eleventh with Retry-After, and admitted a distinct synthetic IP. Twelve simultaneous same-IP requests admitted exactly ten distinct challenges/owner capabilities and denied two. Simulated discarded-201 response followed by manual retry created two distinct immutable challenges, confirming lack of recovery (#471).

The full successful run added 35 challenges, 12 completed attempts, 12 accepted completions and 57 at-bat rows. The earlier failed negative-header run added two challenges and no attempts. Final read-only QA counts: **49 issued / 24 attempts / 24 completed / 114 at-bats**; four quota rows (one daily global at 37 admissions and three client counters totaling 21). Older client counters expired and were lazily removed by the existing reservation RPC. Fixtures/counters are retained and precisely accounted for; no manual cleanup/reset or production write occurred. Production remains **1 issued / 0 attempts / 0 completed / 0 at-bats / 0 budget rows**.

Credentials were transferred from the authenticated QA dashboard using temporary RSA-OAEP encryption, withheld from tool output, and used only by the isolated QA process. Independent random signing/budget secrets were generated locally. No permanent secret provisioning is implied.

Validation: nine startup/origin tests; full workspace tests (10/10 tasks, web 191 files / 1,460 tests); workspace typecheck/lint/file sizes; production build and hidden-answer QA (62 client chunks). Only the QA harness and evidence documents changed. This run does **not** establish actual Vercel ingress/WAF, native browser cookie timing, iOS/Android physical-device acceptance, production rollback, or launch authorization. Those gates stay open; both production public flags remain OFF.

External review, exact-head CI/Preview and merge/deploy verification are separate gates.
