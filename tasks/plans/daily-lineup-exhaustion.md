# Daily lineup exhaustion fix

Status: Implementation scope for issue #136  
Date: 2026-09-10

## Problem

The production Daily selector ranks source player rows before canonical resolution. When multiple source rows resolve to one canonical player, the surviving candidate keeps the first source-row index. That leaves gaps in recognizability ranks. The September 2 reproduction showed only 173 distinct canonical candidates inside source ranks 1–250, which is not enough to sustain two top-band selections under the existing 90-day repeat window.

## Bounded correction

- Rank the deduplicated canonical candidate stream densely for generated Daily lineups beginning 2026-09-02.
- Preserve the previous source-rank interpretation before 2026-09-02 so earlier `lineup-quality-v2` generated lineups do not change.
- Keep published/manual puzzle identity unchanged.
- Keep the 90-day repeat window, slot bands, deterministic seed inputs, scoring, canonical data, and hosting configuration unchanged.
- Keep the correction in portable `packages/daily` candidate construction/selection logic.

## Verification

- Candidate regression proving a 173-of-250 sparse source band becomes 250 distinct canonical top-band candidates after dense ranking.
- Compatibility regression for pre-cutover source-rank semantics.
- Cutover regression for dense canonical rank semantics beginning September 2.
- Continuous generation regression through October 31, 2027.
- Package/full CI, file-size/docs-impact checks, and bounded PR review.

## Explicit exclusions

No published-puzzle edits, no repeat-window reduction, no recognizability-band widening, no scoring changes, no UI changes, no Supabase/hosting changes, and no broader lineup-recipe redesign.
