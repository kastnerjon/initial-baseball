# Daily Nine boxed revealed hints

## Scope contract
- **Goal:** revealed Daily Nine hint values visually match the existing Already guessed boxes, with bold associated labels and safe mobile wrapping.
- **Owning layer:** apps/web presentation.
- **In scope:** AtBatCard's points-v4 hint section, existing daily-game.css box styles, and current handoff/todo reconciliation.
- **Out of scope:** hint ordering/content/authorization, scoring, mechanics, Classic, Custom Lineup and broader redesign.
- **Acceptance checks:** existing AtBatCard suite; browser checks at 320/375/390/768px and desktop with four hints and long stats; typecheck/lint, tests, file sizes, production build through exact-head CI; READY Preview; one independent review; post-merge main/production/routes/logs/open-PR verification.
- **Stop conditions:** a change to game rules, persistence, API contracts or public feature activation requires separate work.

## Architecture
The React section gets a points-v4 presentation class; its values share the existing wrong-guess chip CSS declaration. No domain or data dependency changes. Existing hint nodes/order/values are retained; Classic and Custom styles remain untouched. No new abstraction or dependency is needed.

## Initial operational evidence
Main 106fa52034e0fed23473c8ae96b33d83149c7909 matches PR #416; push CI passed; production dpl_AyNkTDD5TNJr1mhRH3Ra8DqefyYP READY on that SHA; no open PRs. Home/archive healthy, Classic retains its redirect. Supabase initial-baseball-db ACTIVE_HEALTHY and all documented v2 migrations installed. No error/fatal production logs in the inspected 30-minute window. Custom gameplay remains disabled.
