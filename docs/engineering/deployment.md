# Deployment and Release Process

## Mental model

```text
GitHub branch → tests → staging → production
```

Do not edit production directly.

## Mobile updates

### OTA updates

Expo EAS Update can ship JavaScript, UI, and asset updates to installed app builds.

Use for:

- UI layout bugs.
- Text/copy fixes.
- Most TypeScript logic bugs.
- Non-native app behavior.

### Store builds

Submit a new App Store / Play Store build for:

- Native dependency changes.
- Permissions/config changes.
- Push/deep link native changes.
- Expo SDK/native runtime changes.
- App icon/splash/native metadata changes.

## Backend updates

Supabase Edge Functions and migrations deploy separately from the mobile binary.

Rules:

1. Add tests first for rule bugs.
2. Deploy to dev/staging.
3. Test with fake game data.
4. Deploy to production only after verification.
5. If data was corrupted, backfill from `game_events` when possible.

## Rollback principle

- OTA updates should be rollback-able.
- DB migrations should be forward-safe and reviewed.
- Feature flags should be used to disable risky features quickly.
