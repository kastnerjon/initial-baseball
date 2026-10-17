# Daily Five — isolated contract-v2 editorial draft storage adapter

Status: Scoped staging; no route, editor, scheduler or issuer calls this adapter.

## PR scope contract
- **Goal:** An explicit, safe, server-only five-player draft insert/read boundary, without interpreting five-player records as current Daily Nine.
- **Owner:** apps/web Supabase editorial repository adapter and shared row codec.
- **In scope:** explicit contract version 1 for all legacy nine-player reads/writes, fail-closed version check, a separate v2 draft-only insert/read repository with exact-five validation and first-write date conflict, focused tests and docs.
- **Out of scope:** Admin web editor, generating five-player lineups, updating five-player drafts, publish/schedule/issue, historic Daily/Classic/Archive/gameplay, SQL migrations, production fixture writes or public flags.
- **Acceptance:** Focused repository tests and web typecheck; existing nine-player behavior unchanged; independently reviewed exact-head CI and READY Vercel Preview.
- **Stop conditions:** Changes to v1 editorial lifecycle, new DB schema, write to production, external dependency, or activation of issuance are necessary.

## Boundaries
The installed versioned SQL column lineup_contract_version is NOT NULL, default 1; contract 2 requires five players. The existing repository must reject mismatched records, without silent reinterpretation. The separate future-Daily-Five repository exposes only getByDate/insertDraft and is not imported by an API route. First production writes require a subsequent explicitly reviewed admin-only workflow and historical-aware scheduling strategy.
