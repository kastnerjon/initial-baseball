# Public Daily editorial runtime

Status: Implemented contract
Last updated: 2026-07-21

## Purpose

Define how the public Daily game chooses its nine answers when editorial records coexist with deterministic generation. This policy is portable Daily behavior; persistence and HTTP composition remain adapters.

## Ownership

`packages/daily` owns public eligibility and editorial selection identity. `apps/web` reads the provider-neutral `DailyPuzzleRepository`, joins approved canonical IDs to reviewed baseball data, constructs the existing `DailyPuzzle`, and transports only spoiler-safe public state. Supabase stores records but does not decide which lifecycle states are public.

## Selection rules

1. Dates before the lineup-quality launch date `2026-07-22` always use the legacy deterministic selector and historical override path. Editorial rows cannot rewrite those answers.
2. On or after launch, a `scheduled` or `published` record supplies the public canonical player IDs in slot order. Scheduled is already editorially approved; published remains the explicit immutable publication milestone.
3. A missing record, a date-mismatched record, or a `draft` record uses the deterministic quality-selector fallback.
4. An `archived` record does not fall back to a newly generated answer. Public replay fails closed until an explicit archived-history or versioning policy is adopted.
5. An approved record referencing an unavailable canonical player fails closed. The adapter does not substitute another player.

## Puzzle identity and active tokens

Deterministic fallback retains the established `daily-{date}` ID. An editorial puzzle receives an opaque stable ID derived from the date and the ordered canonical selection.

This prevents a progression token issued for fallback from silently switching to a later approved editorial lineup. The same ordered lineup keeps the same identity when it moves from scheduled to published. Any ordered selection change produces a different identity, so an old token is rejected instead of being graded against different answers. The fingerprint exposes no canonical IDs or answer data.

## Security and transport

The repository client and service-role credentials are server-only. The initial browser payload remains limited to puzzle identity, date/number/status, public hint configuration, initials, and an opaque signed progression token. It contains no canonical answer IDs, answer names, hint values, reveal data, database credentials, or repository state.

Hint and resolution requests verify the progression token, reload the same date through the server puzzle source, and release only the hint or terminal reveal authorized by that action. The move to an asynchronous repository-backed source does not change scoring, runner advancement, browser persistence, or progression claims.

## Configuration behavior

When both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are absent, the public runtime retains deterministic fallback so local development and non-hosted builds continue to work. Partial Supabase configuration fails through the existing strict server-client validation rather than silently disabling editorial reads.

## Explicit exclusions

This contract does not add automatic publication, cron jobs, published-puzzle correction/versioning, archived replay, legacy-table migration, aggregate results, public UI changes, or browser access to Supabase.
