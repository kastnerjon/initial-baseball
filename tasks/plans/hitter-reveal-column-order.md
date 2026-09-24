# Hitter reveal column order

Status: bounded implementation scope, September 24, 2026.

## Scope contract

- **Goal:** career and season reveal tables show supported hitter stats in the requested Baseball-Reference relative order.
- **Owning layer:** `apps/web` presentation.
- **In scope:** reorder the existing typed hitter column declaration, verify actual two-way player career/season rendering, and update handoff/task documentation.
- **Out of scope:** hint 4, pitching order, new stat fields, data generation, scoring, clue snapshots, persistence, and route changes.
- **Acceptance checks:** hitter order `AB, R, H, HR, RBI, SB, BA, OBP, SLG, OPS` in both career and season tables; unchanged pitcher columns and override behavior; no altered fact values; horizontal table scrolling and accessible headings remain; focused test, typecheck, repository CI/build, hidden-answer QA and exact-head Preview.
- **Stop conditions:** missing supported hitter facts, altered puzzle clues, or a new source-data requirement calls for separate work.

The existing `DEFAULT_REVEAL_COLUMNS` typed config in `apps/web/app/revealPresentationConfig.ts` drives both reveal tables. The following hint-4 PR should reuse the same relative order while composing hints from supported structured data, without parsing this presentation string or adding unsupported WAR.
