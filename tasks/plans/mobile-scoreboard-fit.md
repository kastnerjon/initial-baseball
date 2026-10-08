# Bottom Daily Nine Scoreboard — mobile fit

## Bounded scope contract

- **Goal:** all five bottom Scoreboard columns and TOTAL metrics fit simultaneously at phone widths without horizontal scrolling, with balanced readable alignment.
- **Owning layer:** existing `apps/web` Scoreboard presentation and scoped responsive CSS.
- **In scope:** fixed proportional columns, compact mobile Result header (desktop Outcome-Score retained), vertically wrapped resolved answers, TOTAL alignment, focused component/render checks, canonical handoff/product/todo reconciliation.
- **Out of scope:** top tracker, Game Complete, sharing, Classic, rules/comparison math, persistence, APIs, data and Supabase mutations.
- **Architecture:** reuse `DailyNineDetailedScoreboard`; JSX and CSS only, no dependency, domain or package-boundary changes. Existing resolved-answer and comparison projections remain authoritative. No duplicate scoreboard or responsive JS state.
- **Acceptance:** actual Chromium measurements at 320/360/375/390/430/768/1366px plus breakpoint edges; collapsed/expanded native disclosure, answer switch, zero/partial/nine ABs, multiword names, half points, missing metrics and populated TOTAL. No table/card/page horizontal overflow or text clipping. Focused tests, repository checks, independent review, exact-head CI/READY Preview, merge and production checks.
- **Stop conditions:** need for a new dependency, scoring/comparison/answer authority change, architectural expansion or an inaccessible fit that requires a new owner design choice.

## Verified starting state

Main `5e521779725aaf72f89586847485d6da9bc7483f`; push CI #1108 succeeded; no open PRs. Production `dpl_DuTS8bTJ6Cq2YB3sask1qJW841dX` READY/canonical; Supabase `dwreeiydvwikpamlokji` ACTIVE_HEALTHY. Source confirms a 440px table minimum even at <=360px. Owner physical-phone feedback supersedes prior acceptance of confined horizontal scrolling.

## Verification

Exact source component bundled with existing React/esbuild into a disposable local fixture; real Chromium keyboard toggling tested native disclosure and Reveal answers. 120 cases: 0/3/9 resolved ABs × compact/completed presentation × answers OFF/ON × 320/360/361/375/390/430/640/641/768/1366px. Long names include Jarrod Saltalamacchia, Jackie Bradley Jr., Michael A. Taylor and Chien-Ming Wang; fixtures include BB 0.5, K 0, missing AB metrics, and worst-width TOTAL 36 / 36.0 / 100%.

All cases measured no page/card/table-region horizontal overflow, no text ranges escaping cell bounds, no header/toggle overlap, and exact TOTAL metric right-edge alignment with corresponding headers. At 320px the table and region both measure 270px; at 390px both measure 332px. Mobile names begin below initials. Collapsing details hides the table; Enter and Space operate disclosure/switch. Screenshots at 320/390/768/1366px inspected. No production results were submitted. Physical iPhone acceptance remains distinct from automated Chromium tests.

Focused component tests cover default answer hiding, unresolved answers, responsive header semantics, long resolved names/half points, zero AB TOTAL, missing peers and final-only BEAT. Full checks and independent review/release evidence follow in the PR.

## Independent review and local checks

One separate fresh-eyes reviewer read AGENTS/scope and exact diff, independently reran all 120 browser cases and eight focused tests, and inspected 320/390/1366px answer-ON screenshots. No in-scope findings. No code changes were needed. Review limitation: fixture Chromium rather than physical Safari/hosted Preview.

Local typecheck, lint, full tests, file sizes, strict runtime data pipeline, current audit, exhaustive season-card QA, runtime-consumer QA and production web build including hidden-answer postbuild QA passed. Generated/check-tool incidental changes are excluded. Hosted exact-head CI/Preview and post-merge release gates remain mandatory.
