# Deployment

This document is the source of truth for deploying Initial Baseball.

## Canonical Production Deployment

- Vercel project: `initial-baseball-web`
- Production URL: `https://initial-baseball-web.vercel.app/`
- GitHub repo: `kastnerjon/initial-baseball`
- Root Directory: `./`
- Install and build config: controlled by the root `vercel.json`
- Required environment variable: `NEXT_PUBLIC_SITE_URL=https://initial-baseball-web.vercel.app`

Do not create duplicate Vercel projects for this repo. If deployment ownership changes, update this document in the same PR as the config or dashboard change. If a cleaner custom or Vercel domain alias such as `initial-baseball.vercel.app` is intentionally attached later, update this document and `NEXT_PUBLIC_SITE_URL` in the same PR or dashboard change.

## Vercel Settings

Use these settings for the canonical `initial-baseball-web` project:

- Application Preset: `Next.js`
- Root Directory: `./`
- Install Command: use the root `vercel.json`
- Build Command: use the root `vercel.json`
- Output Directory: use the root `vercel.json`
- Environment Variables: `NEXT_PUBLIC_SITE_URL=https://initial-baseball-web.vercel.app`

Set `NEXT_PUBLIC_SITE_URL` after the first successful deployment URL is known. The canonical production value should remain `https://initial-baseball-web.vercel.app` unless the production domain intentionally changes.

## Monorepo Build Model

The Next.js app lives in `apps/web`, but it imports workspace packages from `packages/*`. Those packages publish built entrypoints from `dist`, so they must build before `apps/web` on a clean Vercel deployment.

The root `vercel.json` owns this ordering and should build:

1. `@initial-baseball/shared`
2. `@initial-baseball/engine`
3. `@initial-baseball/baseball-data`
4. `@initial-baseball/web`

Do not set Vercel Root Directory to `apps/web`; that bypasses the monorepo workspace build and can break package resolution.

## Troubleshooting

- Stale failed deployments are historical unless they point at the latest `main` SHA in the canonical `initial-baseball-web` project.
- Always compare a failing deployment SHA with the latest `main` SHA before treating it as an active blocker.
- If Vercel cannot resolve `@initial-baseball/shared`, `@initial-baseball/engine`, or `@initial-baseball/baseball-data`, confirm the root `vercel.json` is being used and workspace packages build before `apps/web`.
- Do not create duplicate Vercel projects to test deployment fixes. Fix the canonical `initial-baseball-web` project settings or the root config instead.
- If duplicate PR checks remain attached to GitHub, remove or disconnect the non-canonical Vercel project integration in the Vercel dashboard.
