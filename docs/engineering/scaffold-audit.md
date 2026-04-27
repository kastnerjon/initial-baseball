# Scaffold Audit

## Current scaffold: v0.3

v0.3 pivots the project to **Daily Inning web-first** while preserving the H2H mobile architecture.

Strengths:

- One monorepo, two app surfaces.
- Shared engine prevents web/mobile scoring drift.
- Daily Inning has anonymous identity and account-claim path.
- Share/result model is spoiler-safe.
- Database includes daily puzzle and aggregate-result foundations.
- Mobile app remains in architecture but is not the first playable milestone.

Known limitations:

- Edge Functions are placeholders.
- Web UI is a shell.
- Player seed data is not implemented.
- RLS starts restrictive; policies must be added as queries are implemented.
- Install/tests should be run after pushing because external package install is not available inside this scaffold.
