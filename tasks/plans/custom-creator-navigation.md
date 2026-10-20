# Public Custom creator navigation — default-off staging

## Scope contract
- **Goal:** When *both* no-sign-in creation and Custom v2 gameplay flags are enabled, let a normal Daily player find `/create` and return from the creator to Daily.
- **Owner:** `apps/web` server page composition and presentational navigation.
- **In scope:** Gated Daily footer entry, public creator return link, small-screen footer wrapping and focused static rendering tests.
- **Out of scope:** Enabling flags, database/schema/security changes, anonymous HTTP issuance, additional public pages, publishing/Discover, results/history or new UI theme.
- **Acceptance:** Disabled state retains archive/default footer, enabled state exposes no player answers, tests, CI, READY Vercel Preview and independent review.
- **Stop:** If production needs a new server variable or public page authentication, treat as separate release configuration and security work.

## Architecture
Reuse the server-only `isCustomLineupV2GameplayTransportEnabled()` helper plus the already-required `CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED === 'true'` check (same conditions as `/create`). The pure footer receives a boolean; no runtime security decision is made in React, and disabling either flag hides the entry. The creator backlink never points to an unpublished game or reveals a selection.

No package dependencies, new data contracts or Supabase changes. Footer links wrap at mobile widths without forcing horizontal scroll.

## Documentation impact
Adds this scope and reconciles the active task list. No change to gameplay or public activation.
