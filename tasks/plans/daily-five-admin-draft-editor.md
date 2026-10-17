# Prospective Daily Five — admin-only draft workbench

Status: Admin-local lineup composition with persist operation gated OFF by default.

## Scope contract
- **Goal:** Give authenticated Daily administrators a five-slot ordered canonical player workbench and a guarded draft-only create boundary, while preventing premature calendar writes.
- **Owning layer:** apps/web admin composition, with packages/daily draft constructor and existing insert-only contract-v2 repository reused.
- **In scope:** Basic-auth protected admin page; search, select, reorder/remove exactly five canonical IDs and future puzzle date; server route with same-origin/JSON body guard, exact-five domain validation and insert-only port behind the separate explicit rollout flag; failure and security tests; documentation.
- **Out of scope:** Live flag enablement, any production draft writes, five-player generator/horizon, edits or deletes, publication/scheduling/issuance, existing Daily Nine/Classic/Archive/Custom client changes.
- **Acceptance:** Default-off server refusal without touching storage even with valid admin credentials; both auth and same-origin checked before DB; five ordered canonical players validated; duplicate conflicts; isolated route tests; UI responsive and tests; full CI, independent review and READY Preview.
- **Stop condition:** Actual production writes, v2 editor writes enabled, legacy nine lifecycle changes, schema changes, cross-layer coupling or issuance required.

## Risk disposition
The current Daily Nine horizon uses the same unique editorial date table and its legacy repository explicitly rejects contract 2. A five-player draft on a date still subject to nine-player generation can block that generation. Consequently this stage **does not activate persisted five-player creation**: server reads DAILY_FIVE_DRAFT_WRITES_ENABLED strictly equal to 'true', and the configured production default must remain OFF until prospective issuance and calendar cutover are independently implemented and tested. Merely hiding the Save button would not suffice. The new admin route and private POST never reach current publication or issuance and return no answer information publicly.
