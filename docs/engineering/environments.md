# Environments

Use three Supabase projects.

| Environment | Purpose | Users/data |
|---|---|---|
| Dev | Local/sandbox development | Fake data |
| Staging | Internal/friend testing | Test users |
| Production | Real users | Real data |

Recommended project names:

- `initial-baseball-dev`
- `initial-baseball-staging`
- `initial-baseball-prod`

## Rules

- Coding agents may use dev.
- Staging deploys require intentional approval.
- Production deploys require human approval.
- Never experiment manually in production.
- Production secrets must not be committed or pasted into general prompts.

## Feature flags

Use feature flags for risky features:

- `random_opponents_enabled`
- `chat_enabled`
- `chat_links_enabled` default false
- `chat_media_enabled` default false
- `league_lite_enabled`
- `custom_stats_picker_enabled`

Feature flags let us disable a broken/risky feature without removing code.


## Daily Nine comparison read activation

`DAILY_NINE_COMPARISON_READS_ENABLED` is a server-only web flag and defaults off. Only the trimmed literal `true` enables the comparison GET adapters. Do not prefix it with `NEXT_PUBLIC_`.

The route code may deploy while the flag remains off. Representative isolated read-performance evidence and an explicit activation checkpoint are required before setting it to `true` in Production.
