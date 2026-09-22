# Daily Nine comparison Server-Timing seam

Status: implementation checkpoint

## Scope contract

- **Goal:** expose handler-level comparison timing so a later real-browser trace can distinguish server/provider time from browser/network/render time.
- **Owning layer:** `apps/web` comparison HTTP adapters.
- **In scope:** add one low-cardinality `Server-Timing` metric to each Daily Nine comparison GET route on success, disabled, validation-error, provider-error, and unexpected-error responses; focused route tests; canonical documentation reconciliation.
- **Out of scope:** client telemetry, browser Performance API logging, analytics vendors, database instrumentation, Supabase changes, caching/rollups, comparison semantics, React/UI changes, retry/backoff, or claiming end-to-end p50/p95 without a real browser measurement.
- **Acceptance checks:** at-bat responses expose `daily-comparison-at-bat;dur=<ms>`; completed responses expose `daily-comparison-completed;dur=<ms>`; `private, no-store` and response bodies remain unchanged; focused/full CI and exact-head Preview pass.
- **Stop conditions:** if browser-visible p50/p95 still cannot be measured from a real trace after this seam exists, any client telemetry or persistent metrics collection becomes a separate observability decision.

## Design

The timer begins at the top of each GET adapter and ends immediately before returning the response. It therefore includes route parsing, lazy server composition, authoritative-puzzle loading, Supabase/PostgREST/provider work, Daily normalization, and response construction performed inside the handler.

It does not measure DNS/TLS/public-network transit, browser scheduling, React state propagation, or paint. That distinction is intentional: a real browser trace can compare total request/render delay with the handler duration, while the existing isolated PostgreSQL benchmark remains the database-only reference.

The header contains only a metric name and elapsed milliseconds. It carries no puzzle answer, player identity, request ID, browser identity, payload, or credential.

This is a measurement seam, not the latency result. The provisional approximately 500 ms p95 trigger-to-visible mobile target remains open until enough real-browser samples exist.
