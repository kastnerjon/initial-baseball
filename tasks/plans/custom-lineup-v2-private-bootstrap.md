# Custom Lineup v2 private signed bootstrap predecessor

Status: staged Web server-only implementation; not a public route (2026-10-14).

## Scope contract
- **Goal:** privately read an immutable Custom Lineup v2 issued record of 1–10 slots and issue a domain-separated, signed opening token and authorized first-pitch hint bundle.
- **Owning layer:** `apps/web` server adapter/bootstrap. Reuse portable v2 challenge validation from `packages/daily` and existing Daily hint runtime; no new scores.
- **In scope:** strict schema-2 Supabase row decoder/reader, frozen-order materialization, v2-only signing domain and maximum pitch 10, fail-closed checks, focused tests, canonical handoff note.
- **Out of scope:** public APIs, browser UI, cookie reservation, first-attempt ledger writes, token-based hint/resolve endpoints, score submission, comparisons, feature switches, changes to Daily/Classic/Custom Nine v1.
- **Acceptance:** 1/5/9/10 private opening, invalid/mismatched/legacy failure, no future hint/answer leakage, v2 vs Daily/v1 signature isolation, old tokens remain nine-only; CI/READY preview and independent fresh-eyes review.
- **Stop:** Any need to alter actual public access, signing authority, RLS, result admission or game rules is a separate staged PR.

## Architecture / documentation impact
Only Web server code. `createDailyProgressionTokenCodec` keeps its nine-player default, adding explicit v2 width only when called by the isolated v2 signing domain. Reuses frozen clue decoder with explicit policy and existing server materialization. No hosted SQL or public feature flag changes. Handoff updated with PR #407 completion and staged v2 private bootstrap dependency; do not claim playable Custom gameplay.
