import { readdir } from 'node:fs/promises';

// next start loads these files even when the inherited process env is allowlisted.
// Reject instead of accidentally connecting a local production Supabase project.
const IMPLICIT_NEXT_ENV_FILES = new Set([
  '.env', '.env.local', '.env.production', '.env.production.local',
]);

export async function assertNoImplicitNextEnvironmentFiles(webRoot) {
  const entries = await readdir(webRoot);
  const found = entries.find(name => IMPLICIT_NEXT_ENV_FILES.has(name.toLowerCase()));
  if (found) {
    throw new Error('Default-OFF smoke refuses local Next environment file: ' + found);
  }
}

/**
 * A deliberately credential-free Next runtime for default-OFF Chromium smoke.
 * Never inherit the caller's Supabase, Auth, Vercel, release or CI secrets.
 */
export function createDefaultOffSmokeEnvironment(host, port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Smoke server needs a valid ephemeral loopback port');
  }
  return {
    PATH: host.PATH || '/usr/bin:/bin',
    HOME: host.HOME || '/tmp',
    LANG: host.LANG || 'C.UTF-8',
    TMPDIR: host.TMPDIR || '/tmp',
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    HOSTNAME: '127.0.0.1',
    PORT: String(port),
    DAILY_PROGRESSION_SECRET: 'ci-only-daily-progression-secret-0123456789abcdef',
    CLASSIC_INNING_ENABLED: 'false',
    CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED: 'false',
    CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED: 'false',
    CUSTOM_V2_COMPLETION_DISPLAY_ENABLED: 'false',
    CUSTOM_LINEUP_VARIABLE_STRIKES_ENABLED: 'false',
    CREATOR_AUTH_ENABLED: 'false',
  };
}
