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

`DAILY_NINE_COMPARISON_READS_DISABLED` is the server-only emergency kill switch for the comparison GET adapters. After the September 19 performance/activation checkpoint, reads are enabled by default when the variable is absent. The exact trimmed value `false` also leaves reads enabled; `true`, blank, or malformed explicit values fail closed and return the versioned unavailable response before server comparison composition. Do not prefix it with `NEXT_PUBLIC_`.

The pre-activation `DAILY_NINE_COMPARISON_READS_ENABLED` flag is no longer consulted after activation. Keep environment-based disabling in Vercel Project Settings rather than `vercel.json`, so an operational kill switch can override normal deployment behavior without a code change. Environment-setting changes require a redeploy to affect a deployment.
